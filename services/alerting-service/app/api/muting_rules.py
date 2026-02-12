"""Muting rules API endpoints."""
import logging
import uuid
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.storage import muting_rules

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/muting-rules", tags=["Muting Rules"])


# --- Pydantic models ---

class CreateMutingRuleRequest(BaseModel):
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
async def create_muting_rule(request: CreateMutingRuleRequest) -> dict:
    rule = {
        "rule_id": str(uuid.uuid4()),
        "name": request.name,
        "description": request.description,
        "condition_ids": request.condition_ids,
        "match_criteria": request.match_criteria,
        "start_time": request.start_time,
        "end_time": request.end_time,
        "repeat": request.repeat,
        "enabled": request.enabled,
        "created_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }
    muting_rules.append(rule)
    logger.info("Created muting rule: %s", rule["rule_id"])
    return rule


@router.get("")
async def list_muting_rules() -> List[dict]:
    return muting_rules


@router.delete("/{rule_id}")
async def delete_muting_rule(rule_id: str) -> dict:
    for i, rule in enumerate(muting_rules):
        if rule["rule_id"] == rule_id:
            muting_rules.pop(i)
            return {"status": "deleted", "rule_id": rule_id}
    raise HTTPException(status_code=404, detail="Muting rule not found")
