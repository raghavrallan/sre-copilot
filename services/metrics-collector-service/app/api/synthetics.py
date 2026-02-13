"""
Synthetic monitoring endpoints
"""
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import SyntheticMonitor, SyntheticResult

logger = logging.getLogger(__name__)

router = APIRouter()


class CreateMonitorRequest(BaseModel):
    """Create synthetic monitor request - project_id and tenant_id in body"""
    name: str
    type: str  # ping, api
    url: str
    frequency_seconds: int = 60
    assertions: list[str] = []
    enabled: bool = True
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class UpdateMonitorRequest(BaseModel):
    """Update monitor request"""
    name: Optional[str] = None
    url: Optional[str] = None
    frequency_seconds: Optional[int] = None
    assertions: Optional[list[str]] = None
    enabled: Optional[bool] = None


@router.post("/monitors")
async def create_monitor(request: Request) -> dict[str, Any]:
    """Create monitor. project_id and tenant_id from body."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required")

    monitor_type = body.get("type", "")
    if monitor_type not in ("ping", "api"):
        raise HTTPException(status_code=400, detail="Invalid type")

    @sync_to_async
    def _create():
        mon = SyntheticMonitor.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            name=body.get("name", ""),
            monitor_type=monitor_type,
            url=body.get("url", ""),
            frequency_seconds=int(body.get("frequency_seconds", 60)),
            locations=[],
            config={"assertions": body.get("assertions", [])},
            is_enabled=body.get("enabled", True),
            status="unknown",
        )
        return {
            "monitor_id": str(mon.id),
            "name": mon.name,
            "type": mon.monitor_type,
            "url": mon.url,
            "frequency_seconds": mon.frequency_seconds,
            "assertions": mon.config.get("assertions", []),
            "enabled": mon.is_enabled,
            "results_history": [],
            "last_check": None,
            "last_status": mon.status,
        }

    return await _create()


@router.get("/monitors")
async def list_monitors(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """List monitors with latest status."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        monitors = list(
            SyntheticMonitor.objects.filter(project_id=pid)
            .values("id", "name", "monitor_type", "url", "is_enabled", "status", "last_check_at")
        )
        return [
            {
                "monitor_id": str(m["id"]),
                "name": m["name"],
                "type": m["monitor_type"],
                "url": m["url"],
                "enabled": m["is_enabled"],
                "last_check": m["last_check_at"].isoformat() + "Z" if m["last_check_at"] and m["last_check_at"].tzinfo else (str(m["last_check_at"]) if m["last_check_at"] else None),
                "last_status": m["status"],
            }
            for m in monitors
        ]

    return await _list()


@router.get("/monitors/{monitor_id}/results")
async def get_monitor_results(
    monitor_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """Results list for monitor."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        try:
            mon = SyntheticMonitor.objects.get(project_id=pid, id=monitor_id)
        except (SyntheticMonitor.DoesNotExist, ValueError):
            return None
        results = list(
            SyntheticResult.objects.filter(monitor=mon)
            .values("timestamp", "success", "response_time_ms", "status_code", "location", "error_message")
            .order_by("-timestamp")[:100]
        )
        for r in results:
            if isinstance(r.get("timestamp"), datetime):
                r["timestamp"] = r["timestamp"].isoformat() + "Z" if r["timestamp"].tzinfo else r["timestamp"].isoformat() + "Z"
        return results

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return result


@router.get("/monitors/{monitor_id}")
async def get_monitor(
    monitor_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Monitor detail with results history."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        try:
            mon = SyntheticMonitor.objects.get(project_id=pid, id=monitor_id)
        except (SyntheticMonitor.DoesNotExist, ValueError):
            return None
        results = list(
            SyntheticResult.objects.filter(monitor=mon)
            .values("timestamp", "success", "response_time_ms", "status_code")
            .order_by("-timestamp")[:100]
        )
        for r in results:
            if isinstance(r.get("timestamp"), datetime):
                r["timestamp"] = r["timestamp"].isoformat() + "Z" if r["timestamp"].tzinfo else r["timestamp"].isoformat() + "Z"
        return {
            "monitor_id": str(mon.id),
            "name": mon.name,
            "type": mon.monitor_type,
            "url": mon.url,
            "frequency_seconds": mon.frequency_seconds,
            "assertions": mon.config.get("assertions", []),
            "enabled": mon.is_enabled,
            "results_history": results,
            "last_check": mon.last_check_at.isoformat() + "Z" if mon.last_check_at and mon.last_check_at.tzinfo else (str(mon.last_check_at) if mon.last_check_at else None),
            "last_status": mon.status,
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return result


@router.put("/monitors/{monitor_id}")
async def update_monitor(
    monitor_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Update monitor."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    body = await request.json()

    @sync_to_async
    def _update():
        try:
            mon = SyntheticMonitor.objects.get(project_id=pid, id=monitor_id)
        except (SyntheticMonitor.DoesNotExist, ValueError):
            return None
        if body.get("name") is not None:
            mon.name = body["name"]
        if body.get("url") is not None:
            mon.url = body["url"]
        if body.get("frequency_seconds") is not None:
            mon.frequency_seconds = body["frequency_seconds"]
        if body.get("assertions") is not None:
            cfg = dict(mon.config or {})
            cfg["assertions"] = body["assertions"]
            mon.config = cfg
        if body.get("enabled") is not None:
            mon.is_enabled = body["enabled"]
        mon.save()
        return {
            "monitor_id": str(mon.id),
            "name": mon.name,
            "type": mon.monitor_type,
            "url": mon.url,
            "frequency_seconds": mon.frequency_seconds,
            "assertions": mon.config.get("assertions", []),
            "enabled": mon.is_enabled,
            "results_history": [],
            "last_check": mon.last_check_at.isoformat() + "Z" if mon.last_check_at and mon.last_check_at.tzinfo else (str(mon.last_check_at) if mon.last_check_at else None),
            "last_status": mon.status,
        }

    result = await _update()
    if result is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return result


@router.delete("/monitors/{monitor_id}")
async def delete_monitor(
    monitor_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict:
    """Delete monitor."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _delete():
        try:
            mon = SyntheticMonitor.objects.get(project_id=pid, id=monitor_id)
            mon.delete()
            return True
        except (SyntheticMonitor.DoesNotExist, ValueError):
            return False

    if not await _delete():
        raise HTTPException(status_code=404, detail="Monitor not found")
    return {"status": "deleted", "monitor_id": monitor_id}
