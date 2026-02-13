"""Alert policies API endpoints."""
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import (
    create_policy,
    list_policies,
    get_policy,
    update_policy,
    delete_policy,
    _get_project,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["Alert Policies"])


# --- Pydantic models ---


class CreatePolicyRequest(BaseModel):
    """Request body for creating an alert policy."""

    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field("", max_length=2000)
    condition_ids: List[str] = Field(default_factory=list)
    incident_preference: Literal["per_condition", "per_policy"] = "per_condition"
    enabled: bool = True


class UpdatePolicyRequest(BaseModel):
    """Request body for updating an alert policy."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, max_length=2000)
    condition_ids: Optional[List[str]] = None
    incident_preference: Optional[Literal["per_condition", "per_policy"]] = None
    enabled: Optional[bool] = None


# --- Endpoints ---


@router.post("")
async def create_policy_endpoint(request: CreatePolicyRequest) -> Dict[str, Any]:
    """Create a new alert policy."""
    try:
        project = await _get_project(request.project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    data = request.model_dump(exclude={"project_id"})
    policy = await create_policy(
        project_id=str(project.id),
        tenant_id=str(project.tenant_id),
        data=data,
    )
    logger.info("Created alert policy: %s", policy["policy_id"])
    return policy


@router.get("")
async def list_policies_endpoint(
    project_id: str,
    enabled: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """List all alert policies with optional filter."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await list_policies(
        project_id=str(project.id),
        enabled=enabled,
    )


@router.get("/{policy_id}")
async def get_policy_endpoint(
    policy_id: str,
    project_id: str,
) -> Dict[str, Any]:
    """Get a single alert policy by ID."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    policy = await get_policy(project_id=str(project.id), policy_id=policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.put("/{policy_id}")
async def update_policy_endpoint(
    policy_id: str,
    request: UpdatePolicyRequest,
    project_id: str,
) -> Dict[str, Any]:
    """Update an alert policy."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    update_data = request.model_dump(exclude_unset=True)
    policy = await update_policy(
        project_id=str(project.id),
        policy_id=policy_id,
        data=update_data,
    )
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    logger.info("Updated alert policy: %s", policy_id)
    return policy


@router.delete("/{policy_id}")
async def delete_policy_endpoint(
    policy_id: str,
    project_id: str,
) -> Dict[str, str]:
    """Delete an alert policy."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    deleted = await delete_policy(
        project_id=str(project.id),
        policy_id=policy_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Policy not found")
    logger.info("Deleted alert policy: %s", policy_id)
    return {"status": "deleted", "policy_id": policy_id}
