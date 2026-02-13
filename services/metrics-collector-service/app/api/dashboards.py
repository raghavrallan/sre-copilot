"""
Custom dashboards CRUD endpoints
"""
import logging
import uuid
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import Dashboard

logger = logging.getLogger(__name__)

router = APIRouter()


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
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class UpdateDashboardRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    widgets: Optional[list[WidgetConfig]] = None
    variables: Optional[dict[str, str]] = None


@router.post("")
async def create_dashboard(request: Request) -> dict[str, Any]:
    """Create dashboard. project_id and tenant_id from body."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required")

    name = body.get("name", "")
    description = body.get("description", "")
    widgets = body.get("widgets", [])
    variables = body.get("variables", {})

    widgets_data = []
    for w in widgets:
        wd = w if isinstance(w, dict) else w.model_dump() if hasattr(w, "model_dump") else {}
        if not wd.get("id"):
            wd["id"] = str(uuid.uuid4())
        widgets_data.append(wd)

    variables_data = variables if isinstance(variables, (list, dict)) else {}

    @sync_to_async
    def _create():
        dash = Dashboard.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            name=name,
            description=description,
            widgets=widgets_data,
            variables=variables_data,
            layout={},
            is_default=False,
            created_by="",
        )
        return {
            "dashboard_id": str(dash.id),
            "name": dash.name,
            "description": dash.description,
            "widgets": dash.widgets,
            "variables": dash.variables if isinstance(dash.variables, dict) else dict(dash.variables) if isinstance(dash.variables, list) else {},
            "created_at": dash.created_at.isoformat() + "Z" if dash.created_at.tzinfo else dash.created_at.isoformat() + "Z",
            "updated_at": dash.updated_at.isoformat() + "Z" if dash.updated_at.tzinfo else dash.updated_at.isoformat() + "Z",
        }

    return await _create()


@router.get("")
async def list_dashboards(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list[dict[str, Any]]:
    """List dashboards."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        dashboards = list(
            Dashboard.objects.filter(project_id=pid)
            .values("id", "name", "description", "widgets", "variables", "created_at", "updated_at")
            .order_by("-updated_at")
        )
        return [
            {
                "dashboard_id": str(d["id"]),
                "name": d["name"],
                "description": d["description"],
                "widgets": d["widgets"],
                "variables": d["variables"] if isinstance(d["variables"], dict) else {},
                "created_at": d["created_at"].isoformat() + "Z" if d["created_at"].tzinfo else d["created_at"].isoformat() + "Z",
                "updated_at": d["updated_at"].isoformat() + "Z" if d["updated_at"].tzinfo else d["updated_at"].isoformat() + "Z",
            }
            for d in dashboards
        ]

    return await _list()


@router.get("/{dashboard_id}")
async def get_dashboard(
    dashboard_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get dashboard by ID."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        try:
            dash = Dashboard.objects.get(project_id=pid, id=dashboard_id)
        except (Dashboard.DoesNotExist, ValueError):
            return None
        return {
            "dashboard_id": str(dash.id),
            "name": dash.name,
            "description": dash.description,
            "widgets": dash.widgets,
            "variables": dash.variables if isinstance(dash.variables, dict) else (dict(dash.variables) if isinstance(dash.variables, list) else {}),
            "created_at": dash.created_at.isoformat() + "Z" if dash.created_at.tzinfo else dash.created_at.isoformat() + "Z",
            "updated_at": dash.updated_at.isoformat() + "Z" if dash.updated_at.tzinfo else dash.updated_at.isoformat() + "Z",
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return result


@router.put("/{dashboard_id}")
async def update_dashboard(
    dashboard_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Update dashboard."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    body = await request.json()

    @sync_to_async
    def _update():
        try:
            dash = Dashboard.objects.get(project_id=pid, id=dashboard_id)
        except (Dashboard.DoesNotExist, ValueError):
            return None
        if body.get("name") is not None:
            dash.name = body["name"]
        if body.get("description") is not None:
            dash.description = body["description"]
        if body.get("widgets") is not None:
            widgets = body["widgets"]
            dash.widgets = [w if isinstance(w, dict) else w.model_dump() if hasattr(w, "model_dump") else w for w in widgets]
        if body.get("variables") is not None:
            v = body["variables"]
            dash.variables = v if isinstance(v, list) else list(v.items()) if isinstance(v, dict) else []
        dash.save()
        return {
            "dashboard_id": str(dash.id),
            "name": dash.name,
            "description": dash.description,
            "widgets": dash.widgets,
            "variables": dash.variables if isinstance(dash.variables, dict) else (dict(dash.variables) if isinstance(dash.variables, list) else {}),
            "created_at": dash.created_at.isoformat() + "Z" if dash.created_at.tzinfo else dash.created_at.isoformat() + "Z",
            "updated_at": dash.updated_at.isoformat() + "Z" if dash.updated_at.tzinfo else dash.updated_at.isoformat() + "Z",
        }

    result = await _update()
    if result is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return result


@router.delete("/{dashboard_id}")
async def delete_dashboard(
    dashboard_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict:
    """Delete dashboard."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _delete():
        try:
            dash = Dashboard.objects.get(project_id=pid, id=dashboard_id)
            dash.delete()
            return True
        except (Dashboard.DoesNotExist, ValueError):
            return False

    if not await _delete():
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return {"status": "deleted", "dashboard_id": dashboard_id}
