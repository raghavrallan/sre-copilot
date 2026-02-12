"""
Log management API endpoints.
"""
import asyncio
import json
import logging
import re
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/logs", tags=["Logs"])

# In-memory log storage (populated on startup with demo data)
_log_store: List[Dict[str, Any]] = []

# Queue for live tail SSE
_tail_queue: Optional[asyncio.Queue] = None


def get_log_store() -> List[Dict[str, Any]]:
    """Get the in-memory log store."""
    return _log_store


def set_log_store(logs: List[Dict[str, Any]]) -> None:
    """Set the in-memory log store."""
    global _log_store
    _log_store = logs
    logger.info("Log store initialized with %d entries", len(_log_store))


def get_tail_queue() -> asyncio.Queue:
    """Get or create the tail queue for SSE."""
    global _tail_queue
    if _tail_queue is None:
        _tail_queue = asyncio.Queue()
    return _tail_queue


# --- Pydantic Models ---


class LogEntry(BaseModel):
    """Single log entry model."""

    timestamp: Optional[str] = None
    level: str = "INFO"  # DEBUG, INFO, WARN, ERROR, FATAL
    service_name: str
    message: str
    attributes: Dict[str, Any] = Field(default_factory=dict)
    trace_id: Optional[str] = None
    span_id: Optional[str] = None


class LogIngestRequest(BaseModel):
    """Bulk log ingestion request."""

    logs: List[LogEntry]


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


def _normalize_message(msg: str) -> str:
    """Normalize message for pattern grouping: strip numbers, UUIDs, IPs."""
    if not msg:
        return ""
    # Replace UUIDs (with or without hyphens)
    normalized = re.sub(
        r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}",
        "<uuid>",
        msg,
    )
    # Replace standalone numbers
    normalized = re.sub(r"\b\d+\b", "<num>", normalized)
    # Replace IP addresses
    normalized = re.sub(
        r"\b(?:\d{1,3}\.){3}\d{1,3}\b",
        "<ip>",
        normalized,
    )
    # Replace hex IDs
    normalized = re.sub(r"\b[0-9a-fA-F]{20,}\b", "<id>", normalized)
    # Collapse whitespace
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized


def _log_to_dict(entry: LogEntry) -> Dict[str, Any]:
    """Convert LogEntry to dict for storage."""
    return {
        "timestamp": entry.timestamp,
        "level": entry.level,
        "service_name": entry.service_name,
        "message": entry.message,
        "attributes": entry.attributes,
        "trace_id": entry.trace_id,
        "span_id": entry.span_id,
    }


def _filter_logs(
    logs: List[Dict[str, Any]],
    query: Optional[str] = None,
    service: Optional[str] = None,
    level: Optional[str] = None,
    time_from: Optional[str] = None,
    time_to: Optional[str] = None,
    trace_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Apply filters to log list."""
    result = logs
    if query:
        q = query.lower()
        result = [log for log in result if q in (log.get("message") or "").lower()]
    if service:
        result = [log for log in result if log.get("service_name") == service]
    if level:
        result = [log for log in result if log.get("level") == level.upper()]
    if time_from:
        result = [log for log in result if (log.get("timestamp") or "") >= time_from]
    if time_to:
        result = [log for log in result if (log.get("timestamp") or "") <= time_to]
    if trace_id:
        result = [log for log in result if log.get("trace_id") == trace_id]
    return result


# --- Endpoints ---


@router.post("/ingest")
async def ingest_logs(request: LogIngestRequest) -> Dict[str, Any]:
    """Bulk log ingestion."""
    store = get_log_store()
    queue = get_tail_queue()
    for entry in request.logs:
        data = _log_to_dict(entry)
        store.append(data)
        try:
            queue.put_nowait(data)
        except asyncio.QueueFull:
            pass
    logger.info("Ingested %d log entries", len(request.logs))
    return {"ingested": len(request.logs), "total": len(store)}


@router.get("/search")
async def search_logs(
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
    store = get_log_store()
    filtered = _filter_logs(
        store,
        query=query,
        service=service,
        level=level,
        time_from=time_from,
        time_to=time_to,
        trace_id=trace_id,
    )
    total = len(filtered)
    items = filtered[offset : offset + limit]
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
                if level and log.get("level") != level.upper():
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
async def get_log_patterns() -> Dict[str, Any]:
    """ML-grouped log patterns. Groups logs by normalized message."""
    store = get_log_store()
    pattern_map: Dict[str, Dict[str, Any]] = {}

    for log in store:
        msg = log.get("message") or ""
        normalized = _normalize_message(msg)
        if not normalized:
            continue
        if normalized not in pattern_map:
            pattern_map[normalized] = {
                "pattern": normalized,
                "count": 0,
                "level": log.get("level", "INFO"),
                "sample": msg,
                "first_seen": log.get("timestamp"),
                "last_seen": log.get("timestamp"),
            }
        p = pattern_map[normalized]
        p["count"] += 1
        p["last_seen"] = log.get("timestamp") or p["last_seen"]
        if not p["first_seen"] or (
            log.get("timestamp") and log["timestamp"] < (p["first_seen"] or "")
        ):
            p["first_seen"] = log.get("timestamp")

    patterns = sorted(
        pattern_map.values(),
        key=lambda x: x["count"],
        reverse=True,
    )
    return {"patterns": patterns}


@router.get("/services")
async def list_services() -> Dict[str, Any]:
    """List all services that have reported logs."""
    store = get_log_store()
    services = sorted(set(log.get("service_name", "") for log in store if log.get("service_name")))
    return {"services": services}


@router.get("/stats")
async def get_stats() -> Dict[str, Any]:
    """Log statistics: count by level, count by service, total."""
    store = get_log_store()
    by_level: Dict[str, int] = {}
    by_service: Dict[str, int] = {}
    for log in store:
        level = log.get("level", "INFO")
        by_level[level] = by_level.get(level, 0) + 1
        svc = log.get("service_name", "unknown")
        by_service[svc] = by_service.get(svc, 0) + 1
    return {
        "total": len(store),
        "by_level": by_level,
        "by_service": by_service,
    }
