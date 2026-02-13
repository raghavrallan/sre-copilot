"""Alert policies API endpoints."""
import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import alert_policies

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/policies", tags=["Alert Policies"])


# --- Pydantic models ---


class CreatePolicyRequest(BaseModel):
    """Request body for creating an alert policy."""

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
async def create_policy(request: CreatePolicyRequest) -> Dict[str, Any]:
    """Create a new alert policy."""
    from datetime import datetime

    policy = {
        "policy_id": str(uuid.uuid4()),
        "name": request.name,
        "description": request.description,
        "condition_ids": request.condition_ids,
        "incident_preference": request.incident_preference,
        "enabled": request.enabled,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    alert_policies.append(policy)
    logger.info("Created alert policy: %s", policy["policy_id"])
    return policy


@router.get("")
async def list_policies(enabled: Optional[bool] = None) -> List[Dict[str, Any]]:
    """List all alert policies with optional filter."""
    result = alert_policies
    if enabled is not None:
        result = [p for p in result if p.get("enabled") == enabled]
    return result


@router.get("/{policy_id}")
async def get_policy(policy_id: str) -> Dict[str, Any]:
    """Get a single alert policy by ID."""
    for p in alert_policies:
        if p.get("policy_id") == policy_id:
            return p
    raise HTTPException(status_code=404, detail="Policy not found")


@router.put("/{policy_id}")
async def update_policy(policy_id: str, request: UpdatePolicyRequest) -> Dict[str, Any]:
    """Update an alert policy."""
    for i, p in enumerate(alert_policies):
        if p.get("policy_id") == policy_id:
            update_data = request.model_dump(exclude_unset=True)
            alert_policies[i] = {**p, **update_data}
            logger.info("Updated alert policy: %s", policy_id)
            return alert_policies[i]
    raise HTTPException(status_code=404, detail="Policy not found")


@router.delete("/{policy_id}")
async def delete_policy(policy_id: str) -> Dict[str, str]:
    """Delete an alert policy."""
    for i, p in enumerate(alert_policies):
        if p.get("policy_id") == policy_id:
            alert_policies.pop(i)
            logger.info("Deleted alert policy: %s", policy_id)
            return {"status": "deleted", "policy_id": policy_id}
    raise HTTPException(status_code=404, detail="Policy not found")
