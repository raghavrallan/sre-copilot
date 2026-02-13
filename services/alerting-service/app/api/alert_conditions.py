"""Alert conditions API endpoints."""
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import (
    create_condition,
    list_conditions,
    get_condition,
    update_condition,
    delete_condition,
    _get_project,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/conditions", tags=["Alert Conditions"])


# --- Pydantic models ---


class CreateConditionRequest(BaseModel):
    """Request body for creating an alert condition."""

    project_id: str = Field(..., description="Project ID")
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
async def create_condition_endpoint(request: CreateConditionRequest) -> Dict[str, Any]:
    """Create a new alert condition."""
    try:
        project = await _get_project(request.project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    data = request.model_dump(exclude={"project_id"})
    condition = await create_condition(
        project_id=str(project.id),
        tenant_id=str(project.tenant_id),
        data=data,
    )
    logger.info("Created alert condition: %s", condition["condition_id"])
    return condition


@router.get("")
async def list_conditions_endpoint(
    project_id: str,
    service_name: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """List all alert conditions with optional filters."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await list_conditions(
        project_id=str(project.id),
        service_name=service_name,
        enabled=enabled,
    )


@router.get("/{condition_id}")
async def get_condition_endpoint(
    condition_id: str,
    project_id: str,
) -> Dict[str, Any]:
    """Get a single alert condition by ID."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    condition = await get_condition(project_id=str(project.id), condition_id=condition_id)
    if not condition:
        raise HTTPException(status_code=404, detail="Condition not found")
    return condition


@router.put("/{condition_id}")
async def update_condition_endpoint(
    condition_id: str,
    request: UpdateConditionRequest,
    project_id: str,
) -> Dict[str, Any]:
    """Update an alert condition."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    update_data = request.model_dump(exclude_unset=True)
    condition = await update_condition(
        project_id=str(project.id),
        condition_id=condition_id,
        data=update_data,
    )
    if not condition:
        raise HTTPException(status_code=404, detail="Condition not found")
    logger.info("Updated alert condition: %s", condition_id)
    return condition


@router.delete("/{condition_id}")
async def delete_condition_endpoint(
    condition_id: str,
    project_id: str,
) -> Dict[str, str]:
    """Delete an alert condition."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    deleted = await delete_condition(
        project_id=str(project.id),
        condition_id=condition_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Condition not found")
    logger.info("Deleted alert condition: %s", condition_id)
    return {"status": "deleted", "condition_id": condition_id}
