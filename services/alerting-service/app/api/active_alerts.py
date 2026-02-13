"""Active alerts API endpoints."""
import logging
from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException

from app.storage import list_active_alerts, _get_project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/active-alerts", tags=["Active Alerts"])


@router.get("")
async def list_active_alerts_endpoint(project_id: str) -> List[Dict[str, Any]]:
    """List all currently firing active alerts for a project."""
    try:
        project = await _get_project(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return await list_active_alerts(project_id=str(project.id))
