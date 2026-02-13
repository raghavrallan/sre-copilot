"""
Deployment / change tracking endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.storage import deployments
from app.services.demo_data import generate_demo_deployments

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateDeploymentRequest(BaseModel):
    """Create deployment request"""
    service: str
    version: str
    commit_sha: str
    description: Optional[str] = None
    deployed_by: Optional[str] = None
    timestamp: Optional[str] = None


def _ensure_deployments() -> None:
    """Ensure we have demo deployments if storage is empty."""
    if not deployments:
        deployments.extend(generate_demo_deployments())
        logger.info("Generated demo deployments for empty storage")


@router.post("")
async def create_deployment(request: CreateDeploymentRequest) -> dict[str, Any]:
    """Record a deployment."""
    import uuid
    from datetime import datetime
    dep_id = str(uuid.uuid4())
    ts = request.timestamp or datetime.utcnow().isoformat() + "Z"
    dep = {
        "deployment_id": dep_id,
        "service": request.service,
        "version": request.version,
        "commit_sha": request.commit_sha,
        "description": request.description or "",
        "deployed_by": request.deployed_by or "unknown",
        "timestamp": ts,
    }
    deployments.insert(0, dep)
    return dep


@router.get("")
async def list_deployments(
    service: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list:
    """List deployments with filters."""
    _ensure_deployments()
    filtered = deployments
    if service:
        filtered = [d for d in deployments if d["service"] == service]
    return filtered[:limit]


@router.get("/{deployment_id}")
async def get_deployment(deployment_id: str) -> dict[str, Any]:
    """Get deployment detail."""
    _ensure_deployments()
    for d in deployments:
        if d["deployment_id"] == deployment_id:
            return d
    raise HTTPException(status_code=404, detail="Deployment not found")
