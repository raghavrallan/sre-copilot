"""
Infrastructure monitoring endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import hosts
from app.services.demo_data import generate_demo_hosts

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
    """Host metrics for ingestion"""
    hostname: str
    cpu_percent: float = 0
    memory_percent: float = 0
    disk_usage: float = 0
    network_io: dict = {}
    processes: list = []
    containers: list = []
    timestamp: Optional[str] = None


def _ensure_hosts() -> None:
    """Ensure we have demo hosts if storage is empty."""
    if not hosts:
        for h in generate_demo_hosts():
            hosts[h["hostname"]] = h
        logger.info("Generated demo hosts for empty storage")


@router.post("/ingest")
async def ingest_host_metrics(metrics: HostMetrics) -> dict[str, Any]:
    """Accept host metrics."""
    from datetime import datetime
    ts = metrics.timestamp or datetime.utcnow().isoformat() + "Z"
    entry = {
        "hostname": metrics.hostname,
        "timestamp": ts,
        "cpu_percent": metrics.cpu_percent,
        "memory_percent": metrics.memory_percent,
        "disk_usage": metrics.disk_usage,
        "network_io": metrics.network_io,
        "processes": metrics.processes,
        "containers": metrics.containers,
    }

    if metrics.hostname not in hosts:
        hosts[metrics.hostname] = {
            "hostname": metrics.hostname,
            "latest_metrics": entry,
            "metrics_history": [],
            "processes": metrics.processes,
            "containers": metrics.containers,
        }

    host_data = hosts[metrics.hostname]
    host_data["latest_metrics"] = entry
    host_data["metrics_history"] = host_data.get("metrics_history", [])
    host_data["metrics_history"].append(entry)
    host_data["metrics_history"] = host_data["metrics_history"][-100:]
    host_data["processes"] = metrics.processes
    host_data["containers"] = metrics.containers

    return {"ingested": True, "hostname": metrics.hostname}


@router.get("/hosts")
async def list_hosts() -> list:
    """List all hosts with latest metrics."""
    _ensure_hosts()
    return [
        {
            "hostname": h["hostname"],
            "latest_metrics": h.get("latest_metrics", {}),
        }
        for h in hosts.values()
    ]


@router.get("/hosts/{hostname}")
async def get_host_detail(hostname: str) -> dict[str, Any]:
    """Host detail with metric history."""
    _ensure_hosts()
    if hostname not in hosts:
        raise HTTPException(status_code=404, detail="Host not found")
    return hosts[hostname]


@router.get("/hosts/{hostname}/processes")
async def get_host_processes(hostname: str) -> list:
    """Process list for host."""
    _ensure_hosts()
    if hostname not in hosts:
        raise HTTPException(status_code=404, detail="Host not found")
    return hosts[hostname].get("processes", [])


@router.get("/hosts/{hostname}/containers")
async def get_host_containers(hostname: str) -> list:
    """Container list for host."""
    _ensure_hosts()
    if hostname not in hosts:
        raise HTTPException(status_code=404, detail="Host not found")
    return hosts[hostname].get("containers", [])
