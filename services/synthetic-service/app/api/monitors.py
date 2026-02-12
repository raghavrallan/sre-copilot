"""
Synthetic monitoring endpoints - monitors, results, SLA reports.
"""
import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.demo_data import generate_demo_monitors, generate_demo_results

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Monitors"])

# In-memory storage
MONITORS: dict[str, dict[str, Any]] = {}
RESULTS: dict[str, list[dict[str, Any]]] = {}  # monitor_id -> list of results


# Pydantic models
class MonitorCreate(BaseModel):
    """Create monitor request."""

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


def _get_latest_result(monitor_id: str) -> Optional[dict[str, Any]]:
    """Get latest result for a monitor."""
    results = RESULTS.get(monitor_id, [])
    return results[0] if results else None


def _validate_uuid(value: str) -> str:
    """Validate and return UUID string."""
    try:
        UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid monitor ID format")


# Endpoints
@router.post("", response_model=Monitor)
async def create_monitor(req: MonitorCreate) -> Monitor:
    """Create a new monitor."""
    import uuid

    monitor_id = str(uuid.uuid4())
    monitor = {
        "monitor_id": monitor_id,
        "name": req.name,
        "type": req.type,
        "url": req.url,
        "frequency_seconds": req.frequency_seconds,
        "assertions": req.assertions,
        "headers": req.headers,
        "method": req.method,
        "body": req.body,
        "enabled": req.enabled,
    }
    MONITORS[monitor_id] = monitor
    RESULTS[monitor_id] = []
    logger.info("Created monitor %s: %s", monitor_id, req.name)
    return Monitor(**monitor)


@router.get("", response_model=list[MonitorWithLatestResult])
async def list_monitors() -> list[MonitorWithLatestResult]:
    """List all monitors with latest result."""
    items = []
    for mid, m in MONITORS.items():
        latest = _get_latest_result(mid)
        items.append(
            MonitorWithLatestResult(
                **m,
                latest_result=MonitorResult(**latest) if latest else None,
            )
        )
    return items


@router.get("/{monitor_id}", response_model=MonitorWithLatestResult)
async def get_monitor(monitor_id: str) -> MonitorWithLatestResult:
    """Get monitor detail with recent results."""
    _validate_uuid(monitor_id)
    if monitor_id not in MONITORS:
        raise HTTPException(status_code=404, detail="Monitor not found")
    m = MONITORS[monitor_id]
    latest = _get_latest_result(monitor_id)
    return MonitorWithLatestResult(
        **m,
        latest_result=MonitorResult(**latest) if latest else None,
    )


@router.put("/{monitor_id}", response_model=Monitor)
async def update_monitor(monitor_id: str, req: MonitorUpdate) -> Monitor:
    """Update a monitor."""
    _validate_uuid(monitor_id)
    if monitor_id not in MONITORS:
        raise HTTPException(status_code=404, detail="Monitor not found")
    m = MONITORS[monitor_id]
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        m[k] = v
    logger.info("Updated monitor %s", monitor_id)
    return Monitor(**m)


@router.delete("/{monitor_id}", status_code=204)
async def delete_monitor(monitor_id: str) -> None:
    """Delete a monitor."""
    _validate_uuid(monitor_id)
    if monitor_id not in MONITORS:
        raise HTTPException(status_code=404, detail="Monitor not found")
    del MONITORS[monitor_id]
    if monitor_id in RESULTS:
        del RESULTS[monitor_id]
    logger.info("Deleted monitor %s", monitor_id)


@router.get("/{monitor_id}/results", response_model=dict[str, Any])
async def get_monitor_results(
    monitor_id: str,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> dict[str, Any]:
    """Get results history with pagination."""
    _validate_uuid(monitor_id)
    if monitor_id not in MONITORS:
        raise HTTPException(status_code=404, detail="Monitor not found")
    results = RESULTS.get(monitor_id, [])
    total = len(results)
    start = (page - 1) * limit
    end = start + limit
    page_results = results[start:end]
    return {
        "items": [MonitorResult(**r) for r in page_results],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit if total else 0,
    }


@router.get("/{monitor_id}/sla", response_model=SLAReport)
async def get_monitor_sla(
    monitor_id: str,
    period_hours: int = Query(24, ge=1, le=168),
) -> SLAReport:
    """Get SLA report (uptime %, avg response time, p95, total checks, failures)."""
    _validate_uuid(monitor_id)
    if monitor_id not in MONITORS:
        raise HTTPException(status_code=404, detail="Monitor not found")
    m = MONITORS[monitor_id]
    from datetime import datetime, timedelta

    cutoff = datetime.utcnow() - timedelta(hours=period_hours)
    cutoff_str = cutoff.isoformat() + "Z"
    results = [r for r in RESULTS.get(monitor_id, []) if r["timestamp"] >= cutoff_str]
    total = len(results)
    if total == 0:
        return SLAReport(
            monitor_id=monitor_id,
            monitor_name=m["name"],
            uptime_percent=100.0,
            avg_response_time_ms=0.0,
            p95_response_time_ms=0.0,
            total_checks=0,
            failures=0,
            period_hours=period_hours,
        )
    successes = [r for r in results if r["success"]]
    failures = total - len(successes)
    uptime = (len(successes) / total) * 100.0
    response_times = [r["response_time_ms"] for r in successes if r.get("response_time_ms") is not None]
    avg_rt = sum(response_times) / len(response_times) if response_times else 0.0
    response_times_sorted = sorted(response_times) if response_times else []
    p95_idx = int(len(response_times_sorted) * 0.95) - 1 if response_times_sorted else -1
    p95 = response_times_sorted[p95_idx] if p95_idx >= 0 else 0.0
    return SLAReport(
        monitor_id=monitor_id,
        monitor_name=m["name"],
        uptime_percent=round(uptime, 2),
        avg_response_time_ms=round(avg_rt, 2),
        p95_response_time_ms=round(p95, 2),
        total_checks=total,
        failures=failures,
        period_hours=period_hours,
    )
