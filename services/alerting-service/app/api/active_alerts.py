"""Active alerts API endpoints."""
import logging
from typing import Any, Dict, List

from fastapi import APIRouter
from app.storage import active_alerts, alert_conditions

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/active-alerts", tags=["Active Alerts"])


@router.get("")
async def list_active_alerts() -> List[Dict[str, Any]]:
    """List all currently firing active alerts."""
    result = []
    cond_by_id = {c.get("condition_id"): c for c in alert_conditions if c.get("condition_id")}
    for a in active_alerts:
        cond = cond_by_id.get(a.get("condition_id", ""), {})
        result.append({
            **a,
            "condition_name": cond.get("name", "Unknown"),
            "service_name": cond.get("service_name", ""),
        })
    return result
