"""
Synthetic monitoring endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import monitors
from app.services.demo_data import generate_demo_monitors

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateMonitorRequest(BaseModel):
    """Create synthetic monitor request"""
    name: str
    type: str  # ping, api
    url: str
    frequency_seconds: int = 60
    assertions: list[str] = []
    enabled: bool = True


class UpdateMonitorRequest(BaseModel):
    """Update monitor request"""
    name: Optional[str] = None
    url: Optional[str] = None
    frequency_seconds: Optional[int] = None
    assertions: Optional[list[str]] = None
    enabled: Optional[bool] = None


def _ensure_monitors() -> None:
    """Ensure we have demo monitors if storage is empty."""
    if not monitors:
        for m in generate_demo_monitors():
            monitors[m["monitor_id"]] = m
        logger.info("Generated demo monitors for empty storage")


@router.post("/monitors")
async def create_monitor(request: CreateMonitorRequest) -> dict[str, Any]:
    """Create monitor."""
    import uuid
    if request.type not in ("ping", "api"):
        raise HTTPException(status_code=400, detail="Invalid type")
    monitor_id = str(uuid.uuid4())
    mon = {
        "monitor_id": monitor_id,
        "name": request.name,
        "type": request.type,
        "url": request.url,
        "frequency_seconds": request.frequency_seconds,
        "assertions": request.assertions,
        "enabled": request.enabled,
        "results_history": [],
        "last_check": None,
        "last_status": "unknown",
    }
    monitors[monitor_id] = mon
    return mon


@router.get("/monitors")
async def list_monitors() -> list:
    """List monitors with latest status."""
    _ensure_monitors()
    return [
        {
            "monitor_id": m["monitor_id"],
            "name": m["name"],
            "type": m["type"],
            "url": m["url"],
            "enabled": m["enabled"],
            "last_check": m.get("last_check"),
            "last_status": m.get("last_status"),
        }
        for m in monitors.values()
    ]


@router.get("/monitors/{monitor_id}/results")
async def get_monitor_results(monitor_id: str) -> list:
    """Results list for monitor."""
    _ensure_monitors()
    if monitor_id not in monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return monitors[monitor_id].get("results_history", [])


@router.get("/monitors/{monitor_id}")
async def get_monitor(monitor_id: str) -> dict[str, Any]:
    """Monitor detail with results history."""
    _ensure_monitors()
    if monitor_id not in monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return monitors[monitor_id]


@router.put("/monitors/{monitor_id}")
async def update_monitor(monitor_id: str, request: UpdateMonitorRequest) -> dict[str, Any]:
    """Update monitor."""
    _ensure_monitors()
    if monitor_id not in monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")
    mon = monitors[monitor_id]
    if request.name is not None:
        mon["name"] = request.name
    if request.url is not None:
        mon["url"] = request.url
    if request.frequency_seconds is not None:
        mon["frequency_seconds"] = request.frequency_seconds
    if request.assertions is not None:
        mon["assertions"] = request.assertions
    if request.enabled is not None:
        mon["enabled"] = request.enabled
    return mon


@router.delete("/monitors/{monitor_id}")
async def delete_monitor(monitor_id: str) -> dict:
    """Delete monitor."""
    _ensure_monitors()
    if monitor_id not in monitors:
        raise HTTPException(status_code=404, detail="Monitor not found")
    del monitors[monitor_id]
    return {"status": "deleted", "monitor_id": monitor_id}
