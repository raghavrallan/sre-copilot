"""
SLI/SLO management endpoints
"""
import logging
from typing import Any, Optional

from asgiref.sync import sync_to_async
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import SLO
from shared.utils.responses import validate_project_id, validate_required_fields

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateSLORequest(BaseModel):
    """Create SLO request - project_id and tenant_id in body"""
    name: str
    service_name: str
    sli_type: str  # availability, latency, correctness
    target_percentage: float
    time_window_days: int = 30
    description: Optional[str] = None
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class UpdateSLORequest(BaseModel):
    """Update SLO request"""
    name: Optional[str] = None
    target_percentage: Optional[float] = None
    time_window_days: Optional[int] = None
    description: Optional[str] = None


@router.post("")
async def create_slo(request: Request) -> dict[str, Any]:
    """Create SLO. project_id and tenant_id from body."""
    body = await request.json()
    validate_required_fields(body, ["project_id", "tenant_id", "name", "service_name", "sli_type"])
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")

    sli_type = body.get("sli_type", "")
    if sli_type not in ("availability", "latency", "correctness"):
        raise HTTPException(status_code=400, detail="Invalid sli_type")

    @sync_to_async
    def _create():
        slo = SLO.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            name=body.get("name", ""),
            description=body.get("description", ""),
            service_name=body.get("service_name", ""),
            sli_type=sli_type,
            target_percentage=float(body.get("target_percentage", 100)),
            time_window_days=int(body.get("time_window_days", 30)),
            current_value=100.0,
            error_budget_remaining=float(body.get("target_percentage", 100)),
            status="met",
        )
        return {
            "slo_id": str(slo.id),
            "name": slo.name,
            "service_name": slo.service_name,
            "sli_type": slo.sli_type,
            "target_percentage": slo.target_percentage,
            "time_window_days": slo.time_window_days,
            "description": slo.description,
            "current_compliance": slo.current_value,
            "error_budget_remaining": slo.error_budget_remaining,
            "burn_rate": 1.0,
        }

    return await _create()


@router.get("")
async def list_slos(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """List all SLOs with current compliance."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _list():
        slos = list(
            SLO.objects.filter(project_id=pid)
            .values(
                "id", "name", "service_name", "sli_type", "target_percentage",
                "time_window_days", "description", "current_value", "error_budget_remaining", "status"
            )
        )
        return [
            {
                "slo_id": str(s["id"]),
                "name": s["name"],
                "service_name": s["service_name"],
                "sli_type": s["sli_type"],
                "target_percentage": s["target_percentage"],
                "time_window_days": s["time_window_days"],
                "description": s["description"],
                "current_compliance": s["current_value"],
                "error_budget_remaining": s["error_budget_remaining"],
                "burn_rate": 1.0,
            }
            for s in slos
        ]

    return await _list()


@router.get("/{slo_id}")
async def get_slo(
    slo_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get SLO detail with error budget and burn rate."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        try:
            slo = SLO.objects.get(project_id=pid, id=slo_id)
        except (SLO.DoesNotExist, ValueError):
            return None
        return {
            "slo_id": str(slo.id),
            "name": slo.name,
            "service_name": slo.service_name,
            "sli_type": slo.sli_type,
            "target_percentage": slo.target_percentage,
            "time_window_days": slo.time_window_days,
            "description": slo.description,
            "current_compliance": slo.current_value,
            "error_budget_remaining": slo.error_budget_remaining,
            "burn_rate": 1.0,
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="SLO not found")
    return result


@router.put("/{slo_id}")
async def update_slo(
    slo_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Update SLO."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    body = await request.json()

    @sync_to_async
    def _update():
        try:
            slo = SLO.objects.get(project_id=pid, id=slo_id)
        except (SLO.DoesNotExist, ValueError):
            return None
        if body.get("name") is not None:
            slo.name = body["name"]
        if body.get("target_percentage") is not None:
            slo.target_percentage = body["target_percentage"]
        if body.get("time_window_days") is not None:
            slo.time_window_days = body["time_window_days"]
        if body.get("description") is not None:
            slo.description = body["description"]
        slo.save()
        return {
            "slo_id": str(slo.id),
            "name": slo.name,
            "service_name": slo.service_name,
            "sli_type": slo.sli_type,
            "target_percentage": slo.target_percentage,
            "time_window_days": slo.time_window_days,
            "description": slo.description,
            "current_compliance": slo.current_value,
            "error_budget_remaining": slo.error_budget_remaining,
            "burn_rate": 1.0,
        }

    result = await _update()
    if result is None:
        raise HTTPException(status_code=404, detail="SLO not found")
    return result


@router.delete("/{slo_id}")
async def delete_slo(
    slo_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict:
    """Delete SLO."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _delete():
        try:
            slo = SLO.objects.get(project_id=pid, id=slo_id)
            slo.delete()
            return True
        except (SLO.DoesNotExist, ValueError):
            return False

    if not await _delete():
        raise HTTPException(status_code=404, detail="SLO not found")
    return {"status": "deleted", "slo_id": slo_id}
