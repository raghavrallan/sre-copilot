"""Muting rules API endpoints."""
import logging
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import (
    create_muting_rule,
    list_muting_rules,
    delete_muting_rule,
    _get_project,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/muting-rules", tags=["Muting Rules"])


# --- Pydantic models ---

class CreateMutingRuleRequest(BaseModel):
    project_id: str = Field(..., description="Project ID")
    name: str = Field(..., max_length=200)
    description: str = ""
    condition_ids: List[str] = Field(default_factory=list)
    match_criteria: Dict[str, Any] = Field(default_factory=dict)
    start_time: str = ""
    end_time: str = ""
    repeat: Literal["none", "daily", "weekly"] = "none"
    enabled: bool = True


# --- Endpoints ---

@router.post("")
async def create_muting_rule_endpoint(request: CreateMutingRuleRequest) -> dict:
    """Create a new muting rule."""
    try:
        project = await _get_project(request.project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    data = request.model_dump(exclude={"project_id"})
    rule = await create_muting_rule(
        project_id=str(project.id),
        tenant_id=str(project.tenant_id),
        data=data,
    )
    logger.info("Created muting rule: %s", rule["rule_id"])
    return rule


@router.get("")
async def list_muting_rules_endpoint(project_id: str) -> List[dict]:
    """List all muting rules for a project."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await list_muting_rules(project_id=str(project.id))


@router.delete("/{rule_id}")
async def delete_muting_rule_endpoint(
    rule_id: str,
    project_id: str,
) -> dict:
    """Delete a muting rule."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    deleted = await delete_muting_rule(
        project_id=str(project.id),
        rule_id=rule_id,
    )
    if not deleted:
        raise HTTPException(status_code=404, detail="Muting rule not found")
    return {"status": "deleted", "rule_id": rule_id}
