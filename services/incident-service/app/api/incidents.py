"""
Incident endpoints
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query

from shared.utils.internal_auth import verify_internal_auth

logger = logging.getLogger(__name__)
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
from datetime import datetime
from django.utils import timezone
import httpx
import uuid
import os

from shared.models.incident import Incident, Hypothesis, IncidentState, IncidentSeverity, IncidentActivity, IncidentActivityType
from shared.models.tenant import Tenant
from shared.models.project import Project
from shared.models.analysis_step import AnalysisStep, AnalysisStepType, AnalysisStepStatus
from app.services.redis_publisher import redis_publisher

router = APIRouter()

# Service URLs from environment
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://ai-service:8503")
INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")


class CreateIncidentRequest(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field("", max_length=5000)
    service_name: str = Field(..., max_length=100)
    severity: Literal["critical", "high", "medium", "low"] = "medium"
    project_id: str


class IncidentResponse(BaseModel):
    id: str
    title: str
    description: str
    service_name: str
    state: str
    severity: str
    detected_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedIncidentsResponse(BaseModel):
    items: List[IncidentResponse]
    total: int
    page: int
    limit: int
    pages: int


class HypothesisResponse(BaseModel):
    id: str
    incident_id: str
    claim: str
    description: str
    confidence_score: float
    rank: int
    supporting_evidence: list

    class Config:
        from_attributes = True


class UpdateStateRequest(BaseModel):
    state: Literal["open", "investigating", "acknowledged", "mitigated", "resolved", "closed"]
    comment: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class AddCommentRequest(BaseModel):
    content: str = Field(..., max_length=5000)
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None


class ActivityResponse(BaseModel):
    id: str
    incident_id: str
    activity_type: str
    content: str
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    user_id: Optional[str] = None
    user_name: str
    user_email: str
    created_at: datetime

    class Config:
        from_attributes = True


class UpdateSeverityRequest(BaseModel):
    severity: Literal["critical", "high", "medium", "low"]
    comment: Optional[str] = None
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None


@router.get("/incidents", response_model=PaginatedIncidentsResponse)
async def list_incidents(
    _auth: bool = Depends(verify_internal_auth),
    project_id: str = Query(...),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    severity: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    """List all incidents for a project with pagination"""
    # Verify project exists
    try:
        project = await Project.objects.aget(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # Build query with filters
    queryset = Incident.objects.filter(project=project)

    if severity:
        queryset = queryset.filter(severity=severity)
    if state:
        queryset = queryset.filter(state=state)
    if search:
        from django.db.models import Q
        queryset = queryset.filter(
            Q(title__icontains=search) |
            Q(description__icontains=search) |
            Q(service_name__icontains=search)
        )

    # Get total count
    total = await queryset.acount()

    # Calculate pagination
    skip = (page - 1) * limit
    pages = (total + limit - 1) // limit  # Ceiling division

    # Get incidents
    incidents = []
    async for incident in queryset.order_by('-detected_at')[skip:skip+limit]:
        incidents.append(IncidentResponse(
            id=str(incident.id),
            title=incident.title,
            description=incident.description,
            service_name=incident.service_name,
            state=incident.state,
            severity=incident.severity,
            detected_at=incident.detected_at,
            created_at=incident.created_at
        ))

    return PaginatedIncidentsResponse(
        items=incidents,
        total=total,
        page=page,
        limit=limit,
        pages=pages
    )


@router.post("/incidents", response_model=IncidentResponse)
async def create_incident(request: CreateIncidentRequest, _auth: bool = Depends(verify_internal_auth)):
    """Create a new incident and start full analysis workflow"""
    # Verify project exists
    try:
        project = await Project.objects.select_related('tenant').aget(id=request.project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create incident with investigating state (ticket-like workflow)
    incident = await Incident.objects.acreate(
        tenant=project.tenant,
        project=project,
        title=request.title,
        description=request.description,
        service_name=request.service_name,
        severity=request.severity,
        state=IncidentState.INVESTIGATING,  # Start in investigating state
        detected_at=timezone.now()
    )

    # Create analysis workflow steps
    workflow_steps = [
        (AnalysisStepType.ALERT_RECEIVED, 1, AnalysisStepStatus.COMPLETED),
        (AnalysisStepType.SOURCE_IDENTIFIED, 2, AnalysisStepStatus.COMPLETED),
        (AnalysisStepType.PLATFORM_DETAILS, 3, AnalysisStepStatus.COMPLETED),
        (AnalysisStepType.LOGS_FETCHED, 4, AnalysisStepStatus.IN_PROGRESS),
        (AnalysisStepType.HYPOTHESIS_GENERATED, 5, AnalysisStepStatus.PENDING),
    ]

    for step_type, step_number, status in workflow_steps:
        await AnalysisStep.objects.acreate(
            incident_id=str(incident.id),
            step_type=step_type,
            step_number=step_number,
            status=status,
            started_at=timezone.now() if status != AnalysisStepStatus.PENDING else None,
            completed_at=timezone.now() if status == AnalysisStepStatus.COMPLETED else None,
            input_data={
                "title": incident.title,
                "service_name": incident.service_name,
                "severity": incident.severity
            }
        )

    # Trigger AI hypothesis generation (async, don't wait)
    try:
        headers = {}
        if INTERNAL_SERVICE_KEY:
            headers["X-Internal-Service-Key"] = INTERNAL_SERVICE_KEY
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{AI_SERVICE_URL}/generate-hypotheses",
                json={
                    "incident_id": str(incident.id),
                    "title": incident.title,
                    "description": incident.description,
                    "service_name": incident.service_name
                },
                headers=headers
            )
    except Exception as e:
        logger.warning("Failed to generate hypotheses: %s", e)
        # Don't fail the request if AI service is down

    # Prepare response
    incident_response = IncidentResponse(
        id=str(incident.id),
        title=incident.title,
        description=incident.description,
        service_name=incident.service_name,
        state=incident.state,
        severity=incident.severity,
        detected_at=incident.detected_at,
        created_at=incident.created_at
    )

    # Publish incident.created event to WebSocket
    try:
        await redis_publisher.publish_incident_created(
            incident_data={
                "id": str(incident.id),
                "title": incident.title,
                "description": incident.description,
                "service_name": incident.service_name,
                "state": incident.state,
                "severity": incident.severity,
                "detected_at": incident.detected_at.isoformat(),
                "created_at": incident.created_at.isoformat()
            },
            tenant_id=str(project.tenant.id)
        )
    except Exception as e:
        logger.warning("Failed to publish incident.created event: %s", e)

    return incident_response


@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get a specific incident"""
    try:
        incident = await Incident.objects.select_related('project').aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    return IncidentResponse(
        id=str(incident.id),
        title=incident.title,
        description=incident.description,
        service_name=incident.service_name,
        state=incident.state,
        severity=incident.severity,
        detected_at=incident.detected_at,
        created_at=incident.created_at
    )


@router.get("/incidents-stats")
async def get_incident_stats(
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get incident statistics for dashboard"""
    # Verify project exists
    try:
        project = await Project.objects.aget(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    queryset = Incident.objects.filter(project=project)

    # Get counts
    total = await queryset.acount()
    critical = await queryset.filter(severity='critical').acount()
    high = await queryset.filter(severity='high').acount()
    medium = await queryset.filter(severity='medium').acount()
    low = await queryset.filter(severity='low').acount()

    open_count = await queryset.filter(state='open').acount()
    investigating = await queryset.filter(state='investigating').acount()
    resolved = await queryset.filter(state='resolved').acount()
    closed = await queryset.filter(state='closed').acount()

    return {
        "total": total,
        "by_severity": {
            "critical": critical,
            "high": high,
            "medium": medium,
            "low": low
        },
        "by_state": {
            "open": open_count,
            "investigating": investigating,
            "resolved": resolved,
            "closed": closed
        }
    }


@router.get("/incidents-timeline")
async def get_incident_timeline(
    project_id: str = Query(...),
    days: int = Query(7, ge=1, le=365),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get incident counts grouped by day for timeline chart"""
    from datetime import timedelta
    from django.db.models import Count
    from django.db.models.functions import TruncDate

    # Verify project exists
    try:
        project = await Project.objects.aget(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # Calculate date range
    end_date = timezone.now()
    start_date = end_date - timedelta(days=days)

    # Get incidents grouped by date
    queryset = Incident.objects.filter(
        project=project,
        detected_at__gte=start_date,
        detected_at__lte=end_date
    ).annotate(
        date=TruncDate('detected_at')
    ).values('date').annotate(
        count=Count('id')
    ).order_by('date')

    # Convert to dict for easy lookup
    incidents_by_date = {}
    async for item in queryset:
        if item['date']:
            incidents_by_date[item['date'].isoformat()] = item['count']

    # Build complete timeline with all days
    timeline = []
    for i in range(days):
        date = (start_date + timedelta(days=i)).date()
        date_str = date.isoformat()
        timeline.append({
            "date": date_str,
            "count": incidents_by_date.get(date_str, 0)
        })

    return {
        "days": days,
        "start_date": start_date.date().isoformat(),
        "end_date": end_date.date().isoformat(),
        "timeline": timeline
    }


@router.get("/incidents/{incident_id}/hypotheses", response_model=List[HypothesisResponse])
async def get_hypotheses(
    incident_id: str,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get hypotheses for an incident"""
    # Verify incident exists and belongs to project
    try:
        incident = await Incident.objects.select_related('project').aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Get hypotheses
    hypotheses = []
    async for hypothesis in Hypothesis.objects.filter(incident=incident).order_by('rank'):
        hypotheses.append(HypothesisResponse(
            id=str(hypothesis.id),
            incident_id=str(hypothesis.incident_id),
            claim=hypothesis.claim,
            description=hypothesis.description,
            confidence_score=hypothesis.confidence_score,
            rank=hypothesis.rank,
            supporting_evidence=hypothesis.supporting_evidence
        ))

    return hypotheses


@router.patch("/incidents/{incident_id}/state")
async def update_incident_state(
    incident_id: str,
    request: UpdateStateRequest,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Update incident state with optional comment"""
    # Verify incident exists and belongs to project
    try:
        incident = await Incident.objects.select_related('project').aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_state = incident.state

    # Update state
    incident.state = request.state
    if request.state == IncidentState.ACKNOWLEDGED:
        incident.acknowledged_at = timezone.now()
    elif request.state == IncidentState.RESOLVED:
        incident.resolved_at = timezone.now()

    await incident.asave()

    # Create activity record for state change
    activity_content = request.comment or f"Changed state from {old_state} to {request.state}"
    await IncidentActivity.objects.acreate(
        incident=incident,
        activity_type=IncidentActivityType.STATE_CHANGE,
        content=activity_content,
        old_value=old_state,
        new_value=request.state,
        user_id=request.user_id,
        user_name=request.user_name or "System",
        user_email=request.user_email or ""
    )

    # Publish incident.updated event to WebSocket
    try:
        await redis_publisher.publish_incident_updated(
            incident_data={
                "id": str(incident.id),
                "title": incident.title,
                "description": incident.description,
                "service_name": incident.service_name,
                "state": incident.state,
                "severity": incident.severity,
                "detected_at": incident.detected_at.isoformat(),
                "created_at": incident.created_at.isoformat(),
                "acknowledged_at": incident.acknowledged_at.isoformat() if incident.acknowledged_at else None,
                "resolved_at": incident.resolved_at.isoformat() if incident.resolved_at else None
            },
            tenant_id=str(incident.project.tenant_id)
        )
    except Exception as e:
        logger.warning("Failed to publish incident.updated event: %s", e)

    return {"status": "success", "incident_id": str(incident.id), "new_state": request.state}


@router.patch("/incidents/{incident_id}/severity")
async def update_incident_severity(
    incident_id: str,
    request: UpdateSeverityRequest,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Update incident severity with optional comment"""
    try:
        incident = await Incident.objects.select_related('project').aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    old_severity = incident.severity
    incident.severity = request.severity
    await incident.asave()

    # Create activity record
    activity_content = request.comment or f"Changed severity from {old_severity} to {request.severity}"
    await IncidentActivity.objects.acreate(
        incident=incident,
        activity_type=IncidentActivityType.SEVERITY_CHANGE,
        content=activity_content,
        old_value=old_severity,
        new_value=request.severity,
        user_id=request.user_id,
        user_name=request.user_name or "System",
        user_email=request.user_email or ""
    )

    # Publish update
    try:
        await redis_publisher.publish_incident_updated(
            incident_data={
                "id": str(incident.id),
                "title": incident.title,
                "severity": incident.severity,
                "state": incident.state
            },
            tenant_id=str(incident.project.tenant_id)
        )
        except Exception as e:
            logger.warning("Failed to publish incident.updated event: %s", e)

    return {"status": "success", "incident_id": str(incident.id), "new_severity": request.severity}


@router.post("/incidents/{incident_id}/comments")
async def add_comment(
    incident_id: str,
    request: AddCommentRequest,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Add a comment to an incident"""
    try:
        incident = await Incident.objects.aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    activity = await IncidentActivity.objects.acreate(
        incident=incident,
        activity_type=IncidentActivityType.COMMENT,
        content=request.content,
        user_id=request.user_id,
        user_name=request.user_name or "Anonymous",
        user_email=request.user_email or ""
    )

    return ActivityResponse(
        id=str(activity.id),
        incident_id=str(incident.id),
        activity_type=activity.activity_type,
        content=activity.content,
        old_value=activity.old_value,
        new_value=activity.new_value,
        user_id=str(activity.user_id) if activity.user_id else None,
        user_name=activity.user_name,
        user_email=activity.user_email,
        created_at=activity.created_at
    )


@router.get("/incidents/{incident_id}/activities", response_model=List[ActivityResponse])
async def get_incident_activities(
    incident_id: str,
    project_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get activity timeline for an incident"""
    try:
        incident = await Incident.objects.aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    activities = []
    async for activity in IncidentActivity.objects.filter(incident=incident).order_by('-created_at'):
        activities.append(ActivityResponse(
            id=str(activity.id),
            incident_id=str(incident.id),
            activity_type=activity.activity_type,
            content=activity.content,
            old_value=activity.old_value,
            new_value=activity.new_value,
            user_id=str(activity.user_id) if activity.user_id else None,
            user_name=activity.user_name,
            user_email=activity.user_email,
            created_at=activity.created_at
        ))

    return activities
