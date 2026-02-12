"""
Error tracking endpoints
"""
import logging
import re
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.storage import error_groups
from app.services.demo_data import generate_demo_errors

logger = logging.getLogger(__name__)

router = APIRouter()


class ErrorEvent(BaseModel):
    """Error event for ingestion"""
    service_name: str
    error_class: str
    message: str
    stack_trace: Optional[str] = None
    attributes: dict = {}
    timestamp: Optional[str] = None


class TriageUpdate(BaseModel):
    """Update error group triage status"""
    status: Optional[str] = None  # unresolved, investigating, resolved, ignored
    assignee: Optional[str] = None
    notes: Optional[str] = None


def _normalize_message(msg: str) -> str:
    """Normalize error message for fingerprinting (remove dynamic parts)."""
    normalized = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '<uuid>', msg, flags=re.I)
    normalized = re.sub(r'\d+', '<num>', normalized)
    return normalized[:100]


def _compute_fingerprint(service_name: str, error_class: str, message: str) -> str:
    """Compute fingerprint for error grouping."""
    normalized = _normalize_message(message)
    return f"{service_name}|{error_class}|{normalized}"


def _ensure_errors() -> None:
    """Ensure we have demo errors if storage is empty."""
    if not error_groups:
        for g in generate_demo_errors():
            error_groups[g["fingerprint"]] = g
        logger.info("Generated demo error groups for empty storage")


@router.post("/ingest")
async def ingest_error(event: ErrorEvent) -> dict[str, Any]:
    """Accept error events."""
    from datetime import datetime
    ts = event.timestamp or datetime.utcnow().isoformat() + "Z"
    fingerprint = _compute_fingerprint(event.service_name, event.error_class, event.message)

    occurrence = {
        "timestamp": ts,
        "service_name": event.service_name,
        "stack_trace": event.stack_trace,
        "attributes": event.attributes,
    }

    if fingerprint not in error_groups:
        error_groups[fingerprint] = {
            "fingerprint": fingerprint,
            "service_name": event.service_name,
            "error_class": event.error_class,
            "message": event.message,
            "occurrence_count": 0,
            "first_seen": ts,
            "last_seen": ts,
            "occurrences": [],
            "status": "unresolved",
            "assignee": None,
            "notes": None,
        }

    grp = error_groups[fingerprint]
    grp["occurrence_count"] += 1
    grp["last_seen"] = ts
    grp["occurrences"].insert(0, occurrence)
    grp["occurrences"] = grp["occurrences"][:100]  # Keep last 100

    return {"fingerprint": fingerprint, "ingested": True}


@router.get("/groups")
async def list_error_groups(
    service: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """List error groups with occurrence count and trend."""
    _ensure_errors()

    groups = list(error_groups.values())
    if service:
        groups = [g for g in groups if g.get("service_name") == service]
    if status:
        groups = [g for g in groups if g.get("status") == status]

    groups.sort(key=lambda x: x.get("occurrence_count", 0), reverse=True)
    return groups[:limit]


@router.get("/groups/{fingerprint}")
async def get_error_group(fingerprint: str) -> dict[str, Any]:
    """Get error group detail with occurrences."""
    _ensure_errors()

    if fingerprint not in error_groups:
        raise HTTPException(status_code=404, detail="Error group not found")
    return error_groups[fingerprint]


@router.patch("/groups/{fingerprint}/triage")
async def update_error_triage(fingerprint: str, update: TriageUpdate) -> dict[str, Any]:
    """Update status (unresolved/investigating/resolved/ignored), assignee, notes."""
    _ensure_errors()

    if fingerprint not in error_groups:
        raise HTTPException(status_code=404, detail="Error group not found")

    grp = error_groups[fingerprint]
    if update.status is not None:
        if update.status not in ("unresolved", "investigating", "resolved", "ignored"):
            raise HTTPException(status_code=400, detail="Invalid status")
        grp["status"] = update.status
    if update.assignee is not None:
        grp["assignee"] = update.assignee
    if update.notes is not None:
        grp["notes"] = update.notes

    return {"fingerprint": fingerprint, "status": "updated"}
