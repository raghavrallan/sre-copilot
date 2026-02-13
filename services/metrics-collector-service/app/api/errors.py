"""
Error tracking endpoints
"""
import logging
import re
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import ErrorGroup, ErrorOccurrence, ServiceRegistration
from shared.utils.responses import validate_project_id

logger = logging.getLogger(__name__)

router = APIRouter()


class ErrorEvent(BaseModel):
    """Error event for ingestion - project_id and tenant_id injected by API gateway"""
    service_name: str
    error_class: str
    message: str
    stack_trace: Optional[str] = None
    attributes: dict = {}
    timestamp: Optional[str] = None
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


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


async def _upsert_service_registration(project_id: str, tenant_id: str, service_name: str):
    """Auto-update ServiceRegistration when new data is ingested."""
    @sync_to_async
    def _do():
        reg, _ = ServiceRegistration.objects.update_or_create(
            project_id=project_id,
            tenant_id=tenant_id,
            service_name=service_name,
            defaults={
                "last_seen": timezone.now(),
                "source": "sdk",
                "service_type": "backend",
            },
        )
        return reg

    await _do()


@router.post("/ingest")
async def ingest_error(request: Request) -> dict[str, Any]:
    """Accept error events. project_id and tenant_id from body (injected by gateway)."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required (injected by API gateway)")

    service_name = body.get("service_name", "")
    error_class = body.get("error_class", "")
    message = body.get("message", "")
    stack_trace = body.get("stack_trace", "")
    attributes = body.get("attributes", {})
    ts_str = body.get("timestamp")
    now = timezone.now()
    if ts_str:
        try:
            ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except (ValueError, TypeError):
            ts = now
    else:
        ts = now

    fingerprint = _compute_fingerprint(service_name, error_class, message)

    @sync_to_async
    def _ingest():
        grp, created = ErrorGroup.objects.get_or_create(
            project_id=project_id,
            tenant_id=tenant_id,
            fingerprint=fingerprint,
            defaults={
                "service_name": service_name,
                "error_class": error_class,
                "message": message,
                "occurrence_count": 0,
                "status": "unresolved",
                "assignee": "",
            },
        )
        grp.occurrence_count += 1
        grp.last_seen = ts
        grp.save(update_fields=["occurrence_count", "last_seen"])
        ErrorOccurrence.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            error_group=grp,
            stack_trace=stack_trace,
            attributes=attributes,
            timestamp=ts,
        )
        return fingerprint

    await _ingest()
    await _upsert_service_registration(project_id, tenant_id, service_name)

    return {"fingerprint": fingerprint, "ingested": True}


@router.get("/groups")
async def list_error_groups(
    request: Request,
    project_id: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """List error groups with occurrence count and trend."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _list():
        qs = ErrorGroup.objects.filter(project_id=pid)
        if service:
            qs = qs.filter(service_name=service)
        if status:
            qs = qs.filter(status=status)
        groups = list(
            qs.order_by("-occurrence_count")
            .values(
                "fingerprint", "service_name", "error_class", "message",
                "occurrence_count", "first_seen", "last_seen",
                "status", "assignee"
            )[:limit]
        )
        for g in groups:
            for f in ("first_seen", "last_seen"):
                if isinstance(g.get(f), datetime):
                    g[f] = g[f].isoformat() + "Z" if g[f].tzinfo else g[f].isoformat() + "Z"
        return groups

    return await _list()


@router.get("/groups/{fingerprint}")
async def get_error_group(
    fingerprint: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get error group detail with occurrences."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        try:
            grp = ErrorGroup.objects.get(project_id=pid, fingerprint=fingerprint)
        except ErrorGroup.DoesNotExist:
            return None
        occs = list(
            grp.occurrences.all()
            .values("timestamp", "stack_trace", "attributes")
            .order_by("-timestamp")[:100]
        )
        for o in occs:
            if isinstance(o.get("timestamp"), datetime):
                o["timestamp"] = o["timestamp"].isoformat() + "Z" if o["timestamp"].tzinfo else o["timestamp"].isoformat() + "Z"
        return {
            "fingerprint": grp.fingerprint,
            "service_name": grp.service_name,
            "error_class": grp.error_class,
            "message": grp.message,
            "occurrence_count": grp.occurrence_count,
            "first_seen": grp.first_seen.isoformat() + "Z" if grp.first_seen.tzinfo else grp.first_seen.isoformat() + "Z",
            "last_seen": grp.last_seen.isoformat() + "Z" if grp.last_seen.tzinfo else grp.last_seen.isoformat() + "Z",
            "occurrences": occs,
            "status": grp.status,
            "assignee": grp.assignee or None,
            "notes": None,
        }

    result = await _get()
    if result is None:
        raise HTTPException(status_code=404, detail="Error group not found")
    return result


@router.patch("/groups/{fingerprint}/triage")
async def update_error_triage(
    fingerprint: str,
    update: TriageUpdate,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Update status (unresolved/investigating/resolved/ignored), assignee, notes."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _update():
        try:
            grp = ErrorGroup.objects.get(project_id=pid, fingerprint=fingerprint)
        except ErrorGroup.DoesNotExist:
            return False
        if update.status is not None:
            if update.status not in ("unresolved", "investigating", "resolved", "ignored"):
                raise ValueError("Invalid status")
            grp.status = update.status
        if update.assignee is not None:
            grp.assignee = update.assignee
        grp.save(update_fields=["status", "assignee"])
        return True

    try:
        ok = await _update()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not ok:
        raise HTTPException(status_code=404, detail="Error group not found")
    return {"fingerprint": fingerprint, "status": "updated"}
