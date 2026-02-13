"""
Log management API endpoints.
"""
import asyncio
import json
import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from shared.models.observability import LogEntry as DjangoLogEntry

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/logs", tags=["Logs"])

# Queue for live tail SSE (in-memory for real-time streaming)
_tail_queue: Optional[asyncio.Queue] = None


def get_tail_queue() -> asyncio.Queue:
    """Get or create the tail queue for SSE."""
    global _tail_queue
    if _tail_queue is None:
        _tail_queue = asyncio.Queue()
    return _tail_queue


# --- Pydantic Models ---


class LogEntrySchema(BaseModel):
    """Single log entry schema for request/response."""

    timestamp: Optional[str] = None
    level: str = "INFO"  # DEBUG, INFO, WARN, ERROR, FATAL
    service_name: str
    message: str
    attributes: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


class LogIngestRequest(BaseModel):
    """Bulk log ingestion request."""

    project_id: str
    tenant_id: str
    logs: List[LogEntrySchema]


class LogSearchParams(BaseModel):
    """Log search query parameters."""

    query: Optional[str] = None
    service: Optional[str] = None
    level: Optional[str] = None
    time_from: Optional[str] = None
    time_to: Optional[str] = None
    trace_id: Optional[str] = None
    limit: int = 100
    offset: int = 0


# --- Helper Functions ---


def _parse_timestamp(ts: Optional[str]) -> datetime:
    """Parse ISO timestamp string to datetime. Defaults to now if invalid/missing."""
    if not ts:
        return timezone.now()
    parsed = parse_datetime(ts)
    if parsed is None:
        return timezone.now()
    if timezone.is_naive(parsed):
        return timezone.make_aware(parsed)
    return parsed


def _log_to_dict(entry: DjangoLogEntry) -> Dict[str, Any]:
    """Convert Django LogEntry to dict for response."""
    ts = entry.timestamp
    timestamp_str = ts.isoformat() + "Z" if ts else None
    return {
        "timestamp": timestamp_str,
        "level": entry.level,
        "service_name": entry.service_name,
        "message": entry.message,
        "attributes": entry.attributes or {},
        "trace_id": entry.trace_id or None,
        "span_id": entry.span_id or None,
    }


def _normalize_message(msg: str) -> str:
    """Normalize message for pattern grouping: strip numbers, UUIDs, IPs."""
    if not msg:
        return ""
    normalized = re.sub(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        "<uuid>",
        msg,
    )
    normalized = re.sub(r"\b\d+\b", "<num>", normalized)
    normalized = re.sub(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "<ip>",
        normalized,
    )
    normalized = re.sub(r"\b[0-9a-fA-F]{20,}\b", "<id>", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


# --- Endpoints ---


@router.post("/ingest")
async def ingest_logs(request: LogIngestRequest) -> Dict[str, Any]:
    """Bulk log ingestion."""
    project_id = request.project_id
    tenant_id = request.tenant_id
    queue = get_tail_queue()

    for entry in request.logs:
        timestamp_dt = _parse_timestamp(entry.timestamp)
        level = (entry.level or "INFO").upper()
        trace_id = entry.trace_id or ""
        span_id = entry.span_id or ""
        await DjangoLogEntry.objects.acreate(
            project_id=project_id,
            tenant_id=tenant_id,
            timestamp=timestamp_dt,
            level=level,
            service_name=entry.service_name,
            message=entry.message,
            attributes=entry.attributes or {},
            trace_id=trace_id,
            span_id=span_id,
        )
        # Push to tail queue for live SSE
        data = {
            "timestamp": entry.timestamp,
            "level": level,
            "service_name": entry.service_name,
            "message": entry.message,
            "attributes": entry.attributes or {},
            "trace_id": entry.trace_id,
            "span_id": entry.span_id,
        }
        try:
            queue.put_nowait(data)
        except asyncio.QueueFull:
            pass

    @sync_to_async
    def get_total():
        return DjangoLogEntry.objects.filter(project_id=project_id).count()

    total = await get_total()
    logger.info("Ingested %d log entries for project %s", len(request.logs), project_id)
    return {"ingested": len(request.logs), "total": total}


@router.get("/search")
async def search_logs(
    project_id: str = Query(..., description="Project ID to filter logs"),
    query: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    time_from: Optional[str] = Query(None),
    time_to: Optional[str] = Query(None),
    trace_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> Dict[str, Any]:
    """Full-text search with filters. Returns paginated results."""

    @sync_to_async
    def run_search():
        entries = DjangoLogEntry.objects.filter(project_id=project_id)
        if service:
            entries = entries.filter(service_name=service)
        if level:
            entries = entries.filter(level=level.upper())
        if time_from:
            ts_from = parse_datetime(time_from)
            if ts_from:
                if timezone.is_naive(ts_from):
                    ts_from = timezone.make_aware(ts_from)
                entries = entries.filter(timestamp__gte=ts_from)
        if time_to:
            ts_to = parse_datetime(time_to)
            if ts_to:
                if timezone.is_naive(ts_to):
                    ts_to = timezone.make_aware(ts_to)
                entries = entries.filter(timestamp__lte=ts_to)
        if trace_id:
            entries = entries.filter(trace_id=trace_id)
        if query:
            entries = entries.filter(message__icontains=query)
        total = entries.count()
        entries = entries[offset : offset + limit]
        return list(entries), total

    items_queryset, total = await run_search()
    items = [_log_to_dict(e) for e in items_queryset]
    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/tail")
async def tail_logs(
    service: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
):
    """SSE endpoint for real-time log streaming."""
    queue = get_tail_queue()

    async def event_generator():
        try:
            while True:
                log = await asyncio.wait_for(queue.get(), timeout=30.0)
                if log is None:
                    break
                if service and log.get("service_name") != service:
                    continue
                if level and log.get("level") != (level or "").upper():
                    continue
                yield f"data: {json.dumps(log)}\n\n"
        except asyncio.TimeoutError:
            yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/patterns")
async def get_log_patterns(
    project_id: str = Query(..., description="Project ID to filter logs"),
) -> Dict[str, Any]:
    """ML-grouped log patterns. Groups logs by normalized message."""

    @sync_to_async
    def run_patterns():
        entries = DjangoLogEntry.objects.filter(project_id=project_id)
        return list(entries.values("message", "level", "timestamp"))

    rows = await run_patterns()
    pattern_map: Dict[str, Dict[str, Any]] = {}

    for row in rows:
        msg = row.get("message") or ""
        normalized = _normalize_message(msg)
        if not normalized:
            continue
        ts = row.get("timestamp")
        ts_str = ts.isoformat() + "Z" if ts else None
        if normalized not in pattern_map:
            pattern_map[normalized] = {
                "pattern": normalized,
                "count": 0,
                "level": row.get("level", "INFO"),
                "sample": msg,
                "first_seen": ts_str,
                "last_seen": ts_str,
            }
        p = pattern_map[normalized]
        p["count"] += 1
        p["last_seen"] = ts_str or p["last_seen"]
        if not p["first_seen"] or (ts_str and ts_str < (p["first_seen"] or "")):
            p["first_seen"] = ts_str

    patterns = sorted(
        pattern_map.values(),
        key=lambda x: x["count"],
        reverse=True,
    )
    return {"patterns": patterns}


@router.get("/services")
async def list_services(
    project_id: str = Query(..., description="Project ID to filter logs"),
) -> Dict[str, Any]:
    """List all services that have reported logs."""

    @sync_to_async
    def run_services():
        return list(
            DjangoLogEntry.objects.filter(project_id=project_id)
            .values_list("service_name", flat=True)
            .distinct()
        )

    names = await run_services()
    services = sorted(n for n in names if n)
    return {"services": services}


@router.get("/stats")
async def get_stats(
    project_id: str = Query(..., description="Project ID to filter logs"),
) -> Dict[str, Any]:
    """Log statistics: count by level, count by service, total."""

    @sync_to_async
    def run_stats():
        from django.db.models import Count

        entries = DjangoLogEntry.objects.filter(project_id=project_id)
        total = entries.count()
        by_level = dict(
            entries.values("level").annotate(c=Count("id")).values_list("level", "c")
        )
        by_service = dict(
            entries.values("service_name")
            .annotate(c=Count("id"))
            .values_list("service_name", "c")
        )
        return total, by_level, by_service

    total, by_level, by_service = await run_stats()
    return {
        "total": total,
        "by_level": by_level,
        "by_service": by_service,
    }
