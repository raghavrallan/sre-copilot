"""
Custom dashboards CRUD endpoints
"""
import logging
import uuid
from typing import Any, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory dashboard storage
dashboards: dict[str, dict[str, Any]] = {}


class WidgetConfig(BaseModel):
    id: str = ""
    title: str
    type: str  # line, area, bar, pie, stat, table
    metric_query: str = ""
    width: int = 6  # grid columns (1-12)
    height: int = 4  # grid rows


class CreateDashboardRequest(BaseModel):
    name: str
    description: str = ""
    widgets: list[WidgetConfig] = []
    variables: dict[str, str] = {}


class UpdateDashboardRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[list[WidgetConfig]] = None
    variables: Optional[dict[str, str]] = None


def _ensure_dashboards():
    if not dashboards:
        demo = [
            {
                "dashboard_id": str(uuid.uuid4()),
                "name": "Production Overview",
                "description": "High-level production metrics",
                "widgets": [
                    {"id": str(uuid.uuid4()), "title": "Request Rate", "type": "line", "metric_query": "SELECT rate(count(*), 1 minute) FROM transactions", "width": 6, "height": 4},
                    {"id": str(uuid.uuid4()), "title": "Error Rate", "type": "area", "metric_query": "SELECT percentage(count(*), WHERE error IS true) FROM transactions", "width": 6, "height": 4},
                    {"id": str(uuid.uuid4()), "title": "P95 Latency", "type": "line", "metric_query": "SELECT percentile(duration, 95) FROM transactions", "width": 6, "height": 4},
                    {"id": str(uuid.uuid4()), "title": "Top Services", "type": "bar", "metric_query": "SELECT count(*) FROM transactions FACET service_name", "width": 6, "height": 4},
                ],
                "variables": {"env": "production"},
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            },
            {
                "dashboard_id": str(uuid.uuid4()),
                "name": "Database Performance",
                "description": "Database query monitoring",
                "widgets": [
                    {"id": str(uuid.uuid4()), "title": "Query Count", "type": "stat", "metric_query": "SELECT count(*) FROM db_queries", "width": 3, "height": 2},
                    {"id": str(uuid.uuid4()), "title": "Avg Query Time", "type": "stat", "metric_query": "SELECT average(duration) FROM db_queries", "width": 3, "height": 2},
                    {"id": str(uuid.uuid4()), "title": "Slow Queries", "type": "table", "metric_query": "SELECT * FROM db_queries WHERE duration > 100 LIMIT 10", "width": 12, "height": 6},
                ],
                "variables": {},
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            },
            {
                "dashboard_id": str(uuid.uuid4()),
                "name": "Infrastructure Health",
                "description": "Host and container metrics",
                "widgets": [
                    {"id": str(uuid.uuid4()), "title": "CPU Usage", "type": "line", "metric_query": "SELECT average(cpu_percent) FROM hosts", "width": 6, "height": 4},
                    {"id": str(uuid.uuid4()), "title": "Memory Usage", "type": "area", "metric_query": "SELECT average(memory_percent) FROM hosts", "width": 6, "height": 4},
                    {"id": str(uuid.uuid4()), "title": "Disk I/O", "type": "bar", "metric_query": "SELECT sum(disk_read), sum(disk_write) FROM hosts", "width": 12, "height": 4},
                ],
                "variables": {"host": "*"},
                "created_at": datetime.utcnow().isoformat() + "Z",
                "updated_at": datetime.utcnow().isoformat() + "Z",
            },
        ]
        for d in demo:
            dashboards[d["dashboard_id"]] = d


@router.post("")
async def create_dashboard(request: CreateDashboardRequest) -> dict[str, Any]:
    dashboard_id = str(uuid.uuid4())
    now = datetime.utcnow().isoformat() + "Z"
    widgets = []
    for w in request.widgets:
        wd = w.model_dump()
        if not wd["id"]:
            wd["id"] = str(uuid.uuid4())
        widgets.append(wd)

    dashboard = {
        "dashboard_id": dashboard_id,
        "name": request.name,
        "description": request.description,
        "widgets": widgets,
        "variables": request.variables,
        "created_at": now,
        "updated_at": now,
    }
    dashboards[dashboard_id] = dashboard
    return dashboard


@router.get("")
async def list_dashboards() -> list[dict[str, Any]]:
    _ensure_dashboards()
    return sorted(dashboards.values(), key=lambda d: d.get("updated_at", ""), reverse=True)


@router.get("/{dashboard_id}")
async def get_dashboard(dashboard_id: str) -> dict[str, Any]:
    _ensure_dashboards()
    if dashboard_id not in dashboards:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return dashboards[dashboard_id]


@router.put("/{dashboard_id}")
async def update_dashboard(dashboard_id: str, request: UpdateDashboardRequest) -> dict[str, Any]:
    _ensure_dashboards()
    if dashboard_id not in dashboards:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    d = dashboards[dashboard_id]
    if request.name is not None:
        d["name"] = request.name
    if request.description is not None:
        d["description"] = request.description
    if request.widgets is not None:
        d["widgets"] = [w.model_dump() for w in request.widgets]
    if request.variables is not None:
        d["variables"] = request.variables
    d["updated_at"] = datetime.utcnow().isoformat() + "Z"
    return d


@router.delete("/{dashboard_id}")
async def delete_dashboard(dashboard_id: str) -> dict:
    _ensure_dashboards()
    if dashboard_id not in dashboards:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    del dashboards[dashboard_id]
    return {"status": "deleted", "dashboard_id": dashboard_id}
