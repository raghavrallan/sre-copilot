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


@router.get("/incidents", response_model=List[IncidentResponse])
async def list_incidents(
    project_id: str = Query(...),
    skip: int = 0,
    limit: int = 10
):
    """List all incidents for a project"""
    # Verify project exists
    try:
        project = await Project.objects.aget(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # Get incidents
    incidents = []
    async for incident in Incident.objects.filter(project=project).order_by('-detected_at')[skip:skip+limit]:
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

    return incidents


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
