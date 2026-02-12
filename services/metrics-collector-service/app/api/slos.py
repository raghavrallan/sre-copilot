"""
SLI/SLO management endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import slos
from app.services.demo_data import generate_demo_slos

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateSLORequest(BaseModel):
    """Create SLO request"""
    name: str
    service_name: str
    sli_type: str  # availability, latency, correctness
    target_percentage: float
    time_window_days: int = 30
    description: Optional[str] = None


class UpdateSLORequest(BaseModel):
    """Update SLO request"""
    name: Optional[str] = None
    target_percentage: Optional[float] = None
    time_window_days: Optional[int] = None
    description: Optional[str] = None


def _ensure_slos() -> None:
    """Ensure we have demo SLOs if storage is empty."""
    if not slos:
        for s in generate_demo_slos():
            slos[s["slo_id"]] = s
        logger.info("Generated demo SLOs for empty storage")


@router.post("")
async def create_slo(request: CreateSLORequest) -> dict[str, Any]:
    """Create SLO."""
    import uuid
    if request.sli_type not in ("availability", "latency", "correctness"):
        raise HTTPException(status_code=400, detail="Invalid sli_type")
    slo_id = str(uuid.uuid4())
    slo = {
        "slo_id": slo_id,
        "name": request.name,
        "service_name": request.service_name,
        "sli_type": request.sli_type,
        "target_percentage": request.target_percentage,
        "time_window_days": request.time_window_days,
        "description": request.description or "",
        "current_compliance": 100.0,
        "error_budget_remaining": request.target_percentage,
        "burn_rate": 1.0,
    }
    slos[slo_id] = slo
    return slo


@router.get("")
async def list_slos() -> list:
    """List all SLOs with current compliance."""
    _ensure_slos()
    return list(slos.values())


@router.get("/{slo_id}")
async def get_slo(slo_id: str) -> dict[str, Any]:
    """Get SLO detail with error budget and burn rate."""
    _ensure_slos()
    if slo_id not in slos:
        raise HTTPException(status_code=404, detail="SLO not found")
    return slos[slo_id]


@router.put("/{slo_id}")
async def update_slo(slo_id: str, request: UpdateSLORequest) -> dict[str, Any]:
    """Update SLO."""
    _ensure_slos()
    if slo_id not in slos:
        raise HTTPException(status_code=404, detail="SLO not found")
    slo = slos[slo_id]
    if request.name is not None:
        slo["name"] = request.name
    if request.target_percentage is not None:
        slo["target_percentage"] = request.target_percentage
    if request.time_window_days is not None:
        slo["time_window_days"] = request.time_window_days
    if request.description is not None:
        slo["description"] = request.description
    return slo


@router.delete("/{slo_id}")
async def delete_slo(slo_id: str) -> dict:
    """Delete SLO."""
    _ensure_slos()
    if slo_id not in slos:
        raise HTTPException(status_code=404, detail="SLO not found")
    del slos[slo_id]
    return {"status": "deleted", "slo_id": slo_id}
