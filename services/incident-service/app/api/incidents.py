"""
Incident endpoints
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from django.utils import timezone
import httpx
import uuid

from shared.models.incident import Incident, Hypothesis, IncidentState, IncidentSeverity
from shared.models.tenant import Tenant
from shared.models.project import Project
from app.services.redis_publisher import redis_publisher

router = APIRouter()

# AI Service URL (from environment)
AI_SERVICE_URL = "http://ai-service:8003"


class CreateIncidentRequest(BaseModel):
    title: str
    description: Optional[str] = ""
    service_name: str
    severity: str = "medium"
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


@router.get("/incidents", response_model=PaginatedIncidentsResponse)
async def list_incidents(
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
async def create_incident(request: CreateIncidentRequest):
    """Create a new incident and generate hypotheses"""
    # Verify project exists
    try:
        project = await Project.objects.select_related('tenant').aget(id=request.project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # Create incident
    incident = await Incident.objects.acreate(
        tenant=project.tenant,
        project=project,
        title=request.title,
        description=request.description,
        service_name=request.service_name,
        severity=request.severity,
        state=IncidentState.DETECTED,
        detected_at=timezone.now()
    )

    # Trigger AI hypothesis generation (async, don't wait)
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            await client.post(
                f"{AI_SERVICE_URL}/generate-hypotheses",
                json={
                    "incident_id": str(incident.id),
                    "title": incident.title,
                    "description": incident.description,
                    "service_name": incident.service_name
                }
            )
    except Exception as e:
        print(f"Failed to generate hypotheses: {e}")
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
        print(f"Failed to publish incident.created event: {e}")

    return incident_response


@router.get("/incidents/{incident_id}", response_model=IncidentResponse)
async def get_incident(
    incident_id: str,
    project_id: str = Query(...)
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
    project_id: str = Query(...)
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
    days: int = Query(7, ge=1, le=365)
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
    project_id: str = Query(...)
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
    state: str,
    project_id: str = Query(...)
):
    """Update incident state"""
    # Verify incident exists and belongs to project
    try:
        incident = await Incident.objects.select_related('project').aget(
            id=incident_id,
            project_id=project_id
        )
    except Incident.DoesNotExist:
        raise HTTPException(status_code=404, detail="Incident not found")

    # Update state
    incident.state = state
    if state == IncidentState.ACKNOWLEDGED:
        incident.acknowledged_at = timezone.now()
    elif state == IncidentState.RESOLVED:
        incident.resolved_at = timezone.now()

    await incident.asave()

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
                "created_at": incident.created_at.isoformat()
            },
            tenant_id=str(incident.project.tenant_id)
        )
    except Exception as e:
        print(f"Failed to publish incident.updated event: {e}")

    return {"status": "success", "incident_id": str(incident.id), "new_state": state}
