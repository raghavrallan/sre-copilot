"""
Deployment / change tracking endpoints
"""
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import Deployment
from shared.utils.responses import validate_project_id, validate_required_fields

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateDeploymentRequest(BaseModel):
    """Create deployment request - project_id and tenant_id in body for JWT-authenticated create"""
    service: str
    version: str
    commit_sha: str
    description: Optional[str] = None
    deployed_by: Optional[str] = None
    timestamp: Optional[str] = None
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


@router.post("")
async def create_deployment(request: Request) -> dict[str, Any]:
    """Record a deployment. project_id and tenant_id from body (injected by gateway/user context)."""
    body = await request.json()
    validate_required_fields(body, ["project_id", "tenant_id", "service", "version", "commit_sha"])
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")

    service = body.get("service", "")
    version = body.get("version", "")
    commit_sha = body.get("commit_sha", "")
    description = body.get("description", "")
    deployed_by = body.get("deployed_by", "unknown")
    ts_str = body.get("timestamp")
    now = timezone.now()
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            ts = now
    else:
        ts = now

    dep_id = str(uuid.uuid4())

    @sync_to_async
    def _create():
        dep = Deployment.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            deployment_id=dep_id,
            service=service,
            version=version,
            environment="production",
            commit_sha=commit_sha,
            description=description,
            deployed_by=deployed_by,
            status="success",
            completed_at=ts,
            source="manual",
        )
        return {
            "deployment_id": dep_id,
            "service": dep.service,
            "version": dep.version,
            "commit_sha": dep.commit_sha,
            "description": dep.description,
            "deployed_by": dep.deployed_by,
            "timestamp": dep.completed_at.isoformat() + "Z" if dep.completed_at and dep.completed_at.tzinfo else (dep.completed_at.isoformat() + "Z" if dep.completed_at else now.isoformat() + "Z"),
        }

    return await _create()


@router.get("")
async def list_deployments(
    request: Request,
    project_id: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list:
    """List deployments with filters."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _list():
        qs = Deployment.objects.filter(project_id=pid)
        if service:
            qs = qs.filter(service=service)
        deps = list(
            qs.order_by("-started_at")
            .values("deployment_id", "service", "version", "commit_sha", "description", "deployed_by", "started_at")[:limit]
        )
        for d in deps:
            ts = d.get("started_at")
            if isinstance(ts, datetime):
                d["timestamp"] = ts.isoformat() + "Z" if ts.tzinfo else ts.isoformat() + "Z"
            else:
                d["timestamp"] = str(ts) if ts else ""
        return deps

    return await _list()


@router.get("/{deployment_id}")
async def get_deployment(
    deployment_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get deployment detail."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        try:
            dep = Deployment.objects.get(project_id=pid, deployment_id=deployment_id)
        except Deployment.DoesNotExist:
            try:
                dep = Deployment.objects.get(project_id=pid, id=deployment_id)
            except Deployment.DoesNotExist:
                return None
        return {
            "deployment_id": str(dep.deployment_id or dep.id),
            "service": dep.service,
            "version": dep.version,
            "commit_sha": dep.commit_sha,
            "description": dep.description,
            "deployed_by": dep.deployed_by,
            "timestamp": dep.started_at.isoformat() + "Z" if dep.started_at and dep.started_at.tzinfo else dep.started_at.isoformat() + "Z",
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Deployment not found")
    return result
