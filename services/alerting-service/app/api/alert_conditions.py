"""Alert conditions API endpoints."""
import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import alert_conditions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conditions", tags=["Alert Conditions"])


# --- Pydantic models ---


class CreateConditionRequest(BaseModel):
    """Request body for creating an alert condition."""

    name: str = Field(..., min_length=1, max_length=200)
    metric_name: str = Field(..., min_length=1, max_length=200)
    operator: Literal["gt", "lt", "eq", "gte", "lte"] = Field(...)
    threshold: float = Field(...)
    duration_seconds: int = Field(..., ge=1, le=86400)
    severity: Literal["critical", "warning", "info"] = Field(...)
    service_name: str = Field(..., min_length=1, max_length=200)
    enabled: bool = True


class UpdateConditionRequest(BaseModel):
    """Request body for updating an alert condition."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    metric_name: Optional[str] = Field(None, min_length=1, max_length=200)
    operator: Optional[Literal["gt", "lt", "eq", "gte", "lte"]] = None
    threshold: Optional[float] = None
    duration_seconds: Optional[int] = Field(None, ge=1, le=86400)
    severity: Optional[Literal["critical", "warning", "info"]] = None
    service_name: Optional[str] = Field(None, min_length=1, max_length=200)
    enabled: Optional[bool] = None


# --- Endpoints ---


@router.post("")
async def create_condition(request: CreateConditionRequest) -> Dict[str, Any]:
    """Create a new alert condition."""
    from datetime import datetime

    condition = {
        "condition_id": str(uuid.uuid4()),
        "name": request.name,
        "metric_name": request.metric_name,
        "operator": request.operator,
        "threshold": request.threshold,
        "duration_seconds": request.duration_seconds,
        "severity": request.severity,
        "service_name": request.service_name,
        "enabled": request.enabled,
        "created_at": datetime.utcnow().isoformat() + "Z",
    }
    alert_conditions.append(condition)
    logger.info("Created alert condition: %s", condition["condition_id"])
    return condition


@router.get("")
async def list_conditions(
    service_name: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """List all alert conditions with optional filters."""
    result = alert_conditions
    if service_name:
        result = [c for c in result if c.get("service_name") == service_name]
    if enabled is not None:
        result = [c for c in result if c.get("enabled") == enabled]
    return result


@router.get("/{condition_id}")
async def get_condition(condition_id: str) -> Dict[str, Any]:
    """Get a single alert condition by ID."""
    for c in alert_conditions:
        if c.get("condition_id") == condition_id:
            return c
    raise HTTPException(status_code=404, detail="Condition not found")


@router.put("/{condition_id}")
async def update_condition(condition_id: str, request: UpdateConditionRequest) -> Dict[str, Any]:
    """Update an alert condition."""
    for i, c in enumerate(alert_conditions):
        if c.get("condition_id") == condition_id:
            update_data = request.model_dump(exclude_unset=True)
            alert_conditions[i] = {**c, **update_data}
            logger.info("Updated alert condition: %s", condition_id)
            return alert_conditions[i]
    raise HTTPException(status_code=404, detail="Condition not found")


@router.delete("/{condition_id}")
async def delete_condition(condition_id: str) -> Dict[str, str]:
    """Delete an alert condition."""
    for i, c in enumerate(alert_conditions):
        if c.get("condition_id") == condition_id:
            alert_conditions.pop(i)
            logger.info("Deleted alert condition: %s", condition_id)
            return {"status": "deleted", "condition_id": condition_id}
    raise HTTPException(status_code=404, detail="Condition not found")
