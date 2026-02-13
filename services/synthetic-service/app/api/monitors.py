"""
Synthetic monitoring endpoints - monitors, results, SLA reports.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Optional
from uuid import UUID

from asgiref.sync import sync_to_async
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from shared.models.observability import SyntheticMonitor as SyntheticMonitorModel
from shared.models.observability import SyntheticResult as SyntheticResultModel
from shared.models.project import Project
from shared.utils.responses import validate_uuid as _validate_uuid_shared

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Monitors"])


# Pydantic models
class MonitorCreate(BaseModel):
    """Create monitor request."""

    project_id: str = Field(..., description="Project ID for scoping")
    name: str = Field(..., min_length=1, max_length=200)
    type: str = Field(..., pattern="^(ping|api_test)$")
    url: str = Field(..., min_length=1)
    frequency_seconds: int = Field(..., ge=30, le=86400)
    assertions: list[str] = Field(default_factory=list)
    headers: dict[str, str] = Field(default_factory=dict)
    method: str = Field(default="GET", pattern="^(GET|POST|PUT|PATCH|DELETE|HEAD)$")
    body: Optional[str] = None
    enabled: bool = True


class MonitorUpdate(BaseModel):
    """Update monitor request."""

    name: Optional[str] = Field(None, min_length=1, max_length=200)
    type: Optional[str] = Field(None, pattern="^(ping|api_test)$")
    url: Optional[str] = Field(None, min_length=1)
    frequency_seconds: Optional[int] = Field(None, ge=30, le=86400)
    assertions: Optional[list[str]] = None
    headers: Optional[dict[str, str]] = None
    method: Optional[str] = Field(None, pattern="^(GET|POST|PUT|PATCH|DELETE|HEAD)$")
    body: Optional[str] = None
    enabled: Optional[bool] = None


class MonitorResult(BaseModel):
    """Single monitor result."""

    result_id: str
    monitor_id: str
    timestamp: str
    success: bool
    response_time_ms: Optional[int] = None
    status_code: Optional[int] = None
    error_message: Optional[str] = None
    assertions_passed: Optional[int] = None
    assertions_total: Optional[int] = None


class Monitor(BaseModel):
    """Monitor model."""

    monitor_id: str
    name: str
    type: str
    url: str
    frequency_seconds: int
    assertions: list[str]
    headers: dict[str, str]
    method: str
    body: Optional[str]
    enabled: bool


class MonitorWithLatestResult(Monitor):
    """Monitor with latest result."""

    latest_result: Optional[MonitorResult] = None


class SLAReport(BaseModel):
    """SLA report for a monitor."""

    monitor_id: str
    monitor_name: str
    uptime_percent: float
    avg_response_time_ms: float
    p95_response_time_ms: float
    total_checks: int
    failures: int
    period_hours: int


def _validate_uuid(value: str) -> str:
    """Validate and return UUID string."""
    return _validate_uuid_shared(value, "monitor ID")


def _monitor_type_api_to_model(t: str) -> str:
    """Map API type to model monitor_type."""
    return "api" if t == "api_test" else t


def _monitor_type_model_to_api(t: str) -> str:
    """Map model monitor_type to API type."""
    return "api_test" if t == "api" else t


def _monitor_model_to_response(m: SyntheticMonitorModel) -> dict[str, Any]:
    """Convert Django model to monitor dict."""
    config = m.config or {}
    return {
        "monitor_id": str(m.id),
        "name": m.name,
        "type": _monitor_type_model_to_api(m.monitor_type),
        "url": m.url,
        "frequency_seconds": m.frequency_seconds,
        "assertions": config.get("assertions", []),
        "headers": config.get("headers", {}),
        "method": config.get("method", "GET"),
        "body": config.get("body"),
        "enabled": m.is_enabled,
    }


def _result_model_to_response(r: SyntheticResultModel, monitor_id: str) -> MonitorResult:
    """Convert Django model to result response."""
    return MonitorResult(
        result_id=str(r.id),
        monitor_id=monitor_id,
        timestamp=r.timestamp.isoformat() + "Z" if r.timestamp else "",
        success=r.success,
        response_time_ms=int(r.response_time_ms) if r.response_time_ms is not None else None,
        status_code=r.status_code,
        error_message=r.error_message or None,
        assertions_passed=None,
        assertions_total=None,
    )


@sync_to_async
def _get_project_tenant(project_id: str):
    """Get tenant_id for project."""
    try:
        project = Project.objects.get(id=project_id)
        return project.tenant_id
    except Project.DoesNotExist:
        return None


# Endpoints
@router.post("", response_model=Monitor)
async def create_monitor(req: MonitorCreate) -> Monitor:
    """Create a new monitor."""
    tenant_id = await _get_project_tenant(req.project_id)
    if not tenant_id:
        raise HTTPException(status_code=404, detail="Project not found")

    @sync_to_async
    def do_create():
        m = SyntheticMonitorModel.objects.create(
            project_id=req.project_id,
            tenant_id=tenant_id,
            name=req.name,
            monitor_type=_monitor_type_api_to_model(req.type),
            url=req.url,
            frequency_seconds=req.frequency_seconds,
            locations=[],
            config={
                "assertions": req.assertions,
                "headers": req.headers,
                "method": req.method,
                "body": req.body,
            },
            is_enabled=req.enabled,
        )
        return m

    m = await do_create()
    logger.info("Created monitor %s: %s", m.id, req.name)
    return Monitor(**_monitor_model_to_response(m))


@router.get("", response_model=list[MonitorWithLatestResult])
async def list_monitors(
    project_id: str = Query(..., description="Project ID for scoping"),
) -> list[MonitorWithLatestResult]:
    """List all monitors with latest result."""

    @sync_to_async
    def do_list():
        monitors_list = list(
            SyntheticMonitorModel.objects.filter(project_id=project_id).order_by("-created_at")
        )
        result = []
        for m in monitors_list:
            latest = (
                SyntheticResultModel.objects.filter(monitor_id=m.id)
                .order_by("-timestamp")
                .first()
            )
            base = _monitor_model_to_response(m)
            latest_res = (
                _result_model_to_response(latest, str(m.id)) if latest else None
            )
            result.append(
                MonitorWithLatestResult(**base, latest_result=latest_res)
            )
        return result

    return await do_list()


@router.get("/{monitor_id}", response_model=MonitorWithLatestResult)
async def get_monitor(
    monitor_id: str,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> MonitorWithLatestResult:
    """Get monitor detail with recent results."""
    _validate_uuid(monitor_id)

    @sync_to_async
    def do_get():
        try:
            m = SyntheticMonitorModel.objects.get(id=monitor_id, project_id=project_id)
        except SyntheticMonitorModel.DoesNotExist:
            return None, None
        latest = (
            SyntheticResultModel.objects.filter(monitor_id=m.id)
            .order_by("-timestamp")
            .first()
        )
        return m, latest

    m, latest = await do_get()
    if not m:
        raise HTTPException(status_code=404, detail="Monitor not found")
    base = _monitor_model_to_response(m)
    latest_res = _result_model_to_response(latest, str(m.id)) if latest else None
    return MonitorWithLatestResult(**base, latest_result=latest_res)


@router.put("/{monitor_id}", response_model=Monitor)
async def update_monitor(
    monitor_id: str,
    req: MonitorUpdate,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> Monitor:
    """Update a monitor."""
    _validate_uuid(monitor_id)

    @sync_to_async
    def do_update():
        try:
            m = SyntheticMonitorModel.objects.get(id=monitor_id, project_id=project_id)
        except SyntheticMonitorModel.DoesNotExist:
            return None
        update_data = req.model_dump(exclude_unset=True)
        if "type" in update_data:
            m.monitor_type = _monitor_type_api_to_model(update_data.pop("type"))
        if "enabled" in update_data:
            m.is_enabled = update_data.pop("enabled")
        config = dict(m.config or {})
        for k in ["assertions", "headers", "method", "body"]:
            if k in update_data and update_data[k] is not None:
                config[k] = update_data.pop(k)
        m.config = config
        for k, v in update_data.items():
            if hasattr(m, k):
                setattr(m, k, v)
        m.save()
        return m

    m = await do_update()
    if not m:
        raise HTTPException(status_code=404, detail="Monitor not found")
    logger.info("Updated monitor %s", monitor_id)
    return Monitor(**_monitor_model_to_response(m))


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(
    monitor_id: str,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> None:
    """Delete a monitor."""
    _validate_uuid(monitor_id)

    @sync_to_async
    def do_delete():
        deleted, _ = SyntheticMonitorModel.objects.filter(
            id=monitor_id, project_id=project_id
        ).delete()
        return deleted

    deleted = await do_delete()
    if not deleted:
        raise HTTPException(status_code=404, detail="Monitor not found")
    logger.info("Deleted monitor %s", monitor_id)


@router.get("/{monitor_id}/results", response_model=dict[str, Any])
async def get_monitor_results(
    monitor_id: str,
    project_id: str = Query(..., description="Project ID for scoping"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Get results history with pagination."""
    _validate_uuid(monitor_id)

    @sync_to_async
    def do_results():
        if not SyntheticMonitorModel.objects.filter(id=monitor_id, project_id=project_id).exists():
            return None, 0, []
        total = SyntheticResultModel.objects.filter(monitor_id=monitor_id).count()
        qs = SyntheticResultModel.objects.filter(monitor_id=monitor_id).order_by("-timestamp")
        results = list(qs[(page - 1) * limit : page * limit])
        return monitor_id, total, results

    mid, total, results = await do_results()
    if mid is None:
        raise HTTPException(status_code=404, detail="Monitor not found")
    return {
        "items": [_result_model_to_response(r, mid) for r in results],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total else 0,
    }


@router.get("/{monitor_id}/sla", response_model=SLAReport)
async def get_monitor_sla(
    monitor_id: str,
    project_id: str = Query(..., description="Project ID for scoping"),
    period_hours: int = Query(24, ge=1, le=168),
) -> SLAReport:
    """Get SLA report (uptime %, avg response time, p95, total checks, failures)."""
    _validate_uuid(monitor_id)

    @sync_to_async
    def do_sla():
        try:
            m = SyntheticMonitorModel.objects.get(id=monitor_id, project_id=project_id)
        except SyntheticMonitorModel.DoesNotExist:
            return None
        cutoff = datetime.utcnow() - timedelta(hours=period_hours)
        results = list(
            SyntheticResultModel.objects.filter(
                monitor_id=monitor_id, timestamp__gte=cutoff
            ).values("success", "response_time_ms")
        )
        total = len(results)
        if total == 0:
            return m, 100.0, 0.0, 0.0, 0, 0
        successes = [r for r in results if r["success"]]
        failures = total - len(successes)
        uptime = (len(successes) / total) * 100.0
        response_times = [
            r["response_time_ms"]
            for r in successes
            if r.get("response_time_ms") is not None
        ]
        avg_rt = sum(response_times) / len(response_times) if response_times else 0.0
        response_times_sorted = sorted(response_times) if response_times else []
        p95_idx = int(len(response_times_sorted) * 0.95) - 1 if response_times_sorted else -1
        p95 = response_times_sorted[p95_idx] if p95_idx >= 0 else 0.0
        return m, uptime, avg_rt, p95, total, failures

    out = await do_sla()
    if not out:
        raise HTTPException(status_code=404, detail="Monitor not found")
    m, uptime, avg_rt, p95, total, failures = out
    return SLAReport(
        monitor_id=monitor_id,
        monitor_name=m.name,
        uptime_percent=round(uptime, 2),
        avg_response_time_ms=round(avg_rt, 2),
        p95_response_time_ms=round(p95, 2),
        total_checks=total,
        failures=failures,
        period_hours=period_hours,
    )
