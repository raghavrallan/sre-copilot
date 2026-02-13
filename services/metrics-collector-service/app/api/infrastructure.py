"""
Infrastructure monitoring endpoints
"""
import logging
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import HostMetric

logger = logging.getLogger(__name__)

router = APIRouter()


class NetworkIO(BaseModel):
    """Network I/O metrics"""
    bytes_sent: int = 0
    bytes_recv: int = 0


class ProcessInfo(BaseModel):
    """Process info"""
    pid: int
    name: str
    cpu_percent: float = 0
    memory_percent: float = 0


class ContainerInfo(BaseModel):
    """Container info"""
    id: str
    name: str
    state: str = "running"


class HostMetrics(BaseModel):
    """Host metrics for ingestion - project_id and tenant_id injected by API gateway"""
    hostname: str
    cpu_percent: float = 0
    memory_percent: float = 0
    disk_usage: Any = 0
    network_io: dict = {}
    processes: list = []
    containers: list = []
    timestamp: Optional[str] = None


@router.post("/ingest")
async def ingest_host_metrics(request: Request) -> dict[str, Any]:
    """Accept host metrics. project_id and tenant_id from body (injected by gateway)."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required (injected by API gateway)")

    hostname = body.get("hostname", "")
    cpu_percent = body.get("cpu_percent", 0)
    memory_percent = body.get("memory_percent", 0)
    disk_usage = body.get("disk_usage", 0)
    network_io = body.get("network_io", {})
    processes = body.get("processes", [])
    containers = body.get("containers", [])
    ts_str = body.get("timestamp")
    now = timezone.now()
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            ts = now
    else:
        ts = now

    disk_usage_json = disk_usage if isinstance(disk_usage, dict) else {"total": disk_usage}

    @sync_to_async
    def _create():
        HostMetric.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            hostname=hostname,
            cpu_percent=cpu_percent,
            memory_percent=memory_percent,
            disk_usage=disk_usage_json,
            network_io=network_io,
            processes=processes,
            containers=containers,
            timestamp=ts,
        )

    await _create()
    return {"ingested": True, "hostname": hostname}


@router.get("/hosts")
async def list_hosts(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """List all hosts with latest metrics."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        hostnames = list(
            HostMetric.objects.filter(project_id=pid)
            .values_list("hostname", flat=True)
            .distinct()
        )
        result = []
        for hn in hostnames:
            latest = (
                HostMetric.objects.filter(project_id=pid, hostname=hn)
                .order_by("-timestamp")
                .values("hostname", "timestamp", "cpu_percent", "memory_percent", "disk_usage", "network_io", "processes", "containers")
                .first()
            )
            if latest:
                ts = latest.get("timestamp")
                if isinstance(ts, datetime):
                    latest["timestamp"] = ts.isoformat() + "Z" if ts.tzinfo else ts.isoformat() + "Z"
                result.append({
                    "hostname": latest["hostname"],
                    "latest_metrics": {
                        "hostname": latest["hostname"],
                        "timestamp": latest["timestamp"],
                        "cpu_percent": latest["cpu_percent"],
                        "memory_percent": latest["memory_percent"],
                        "disk_usage": latest["disk_usage"],
                        "network_io": latest["network_io"],
                        "processes": latest["processes"],
                        "containers": latest["containers"],
                    },
                })
        return result

    return await _list()


@router.get("/hosts/{hostname}")
async def get_host_detail(
    hostname: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Host detail with metric history."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        metrics = list(
            HostMetric.objects.filter(project_id=pid, hostname=hostname)
            .order_by("-timestamp")
            .values("timestamp", "cpu_percent", "memory_percent", "disk_usage", "network_io", "processes", "containers")[:100]
        )
        if not metrics:
            return None
        for m in metrics:
            if isinstance(m.get("timestamp"), datetime):
                m["timestamp"] = m["timestamp"].isoformat() + "Z" if m["timestamp"].tzinfo else m["timestamp"].isoformat() + "Z"
        latest = metrics[0]
        return {
            "hostname": hostname,
            "latest_metrics": latest,
            "metrics_history": metrics,
            "processes": latest.get("processes", []),
            "containers": latest.get("containers", []),
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return result


@router.get("/hosts/{hostname}/processes")
async def get_host_processes(
    hostname: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """Process list for host."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        latest = (
            HostMetric.objects.filter(project_id=pid, hostname=hostname)
            .order_by("-timestamp")
            .values("processes")
            .first()
        )
        return latest["processes"] if latest else None

    processes = await _get()
    if processes is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return processes


@router.get("/hosts/{hostname}/containers")
async def get_host_containers(
    hostname: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list:
    """Container list for host."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        latest = (
            HostMetric.objects.filter(project_id=pid, hostname=hostname)
            .order_by("-timestamp")
            .values("containers")
            .first()
        )
        return latest["containers"] if latest else None

    containers = await _get()
    if containers is None:
        raise HTTPException(status_code=404, detail="Host not found")
    return containers
