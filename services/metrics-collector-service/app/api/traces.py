"""
Distributed tracing endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.storage import traces, spans_by_trace
from app.services.demo_data import generate_demo_traces

logger = logging.getLogger(__name__)

router = APIRouter()


class SpanModel(BaseModel):
    """Span for distributed trace"""
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    service_name: str
    operation: str
    duration_ms: float
    status: str = "ok"
    attributes: dict = {}
    events: list = []
    timestamp: Optional[str] = None


class TraceIngestRequest(BaseModel):
    """Trace ingest request with spans"""
    spans: list[SpanModel]


def _ensure_traces() -> None:
    """Ensure we have demo traces if storage is empty."""
    if not traces:
        trace_list = generate_demo_traces()
        for t in trace_list:
            traces.append({"trace_id": t["trace_id"], "spans": t["spans"]})
            spans_by_trace[t["trace_id"]] = t["spans"]
        logger.info("Generated demo traces for empty storage")


@router.post("/ingest")
async def ingest_traces(request: TraceIngestRequest) -> dict[str, Any]:
    """Accept spans for distributed tracing."""
    trace_ids = set()
    for span in request.spans:
        span_data = span.model_dump()
        if span.trace_id not in spans_by_trace:
            spans_by_trace[span.trace_id] = []
        spans_by_trace[span.trace_id].append(span_data)
        trace_ids.add(span.trace_id)

    for tid in trace_ids:
        if not any(t["trace_id"] == tid for t in traces):
            traces.append({"trace_id": tid, "spans": spans_by_trace[tid]})

    logger.info("Ingested %d spans for %d traces", len(request.spans), len(trace_ids))
    return {"ingested_spans": len(request.spans), "trace_ids": list(trace_ids)}


@router.get("")
async def list_traces(
    service: Optional[str] = Query(None),
    min_duration: Optional[float] = Query(None),
    max_duration: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """List traces with filters."""
    _ensure_traces()

    result = []
    for t in traces:
        tid = t["trace_id"]
        spans = spans_by_trace.get(tid, t.get("spans", []))
        if not spans:
            continue

        total_duration = sum(s.get("duration_ms", 0) for s in spans)
        if min_duration is not None and total_duration < min_duration:
            continue
        if max_duration is not None and total_duration > max_duration:
            continue

        services_in_trace = set(s.get("service_name") for s in spans)
        if service is not None and service not in services_in_trace:
            continue

        if status is not None:
            span_statuses = [s.get("status") for s in spans]
            if status not in span_statuses:
                continue

        result.append({
            "trace_id": tid,
            "duration_ms": round(total_duration, 2),
            "service_count": len(services_in_trace),
            "span_count": len(spans),
        })
        if len(result) >= limit:
            break

    return result


@router.get("/services/dependency-map")
async def get_service_dependency_map() -> dict[str, Any]:
    """Get service dependency map from trace data."""
    _ensure_traces()

    edges: list[tuple[str, str]] = []
    for t in traces:
        spans = spans_by_trace.get(t["trace_id"], t.get("spans", []))
        span_by_id = {s["span_id"]: s for s in spans}
        for s in spans:
            parent_id = s.get("parent_span_id")
            if parent_id and parent_id in span_by_id:
                parent = span_by_id[parent_id]
                child_svc = s.get("service_name")
                parent_svc = parent.get("service_name")
                if child_svc != parent_svc:
                    edges.append((parent_svc, child_svc))

    nodes = set()
    for a, b in edges:
        nodes.add(a)
        nodes.add(b)

    return {
        "nodes": list(nodes),
        "edges": [{"source": a, "target": b} for a, b in edges],
        "dependency_map": {n: list(set(b for a, b in edges if a == n)) for n in nodes},
    }


@router.get("/{trace_id}")
async def get_trace(trace_id: str) -> dict[str, Any]:
    """Get all spans for a trace (waterfall data)."""
    _ensure_traces()

    spans = spans_by_trace.get(trace_id)
    if not spans:
        for t in traces:
            if t["trace_id"] == trace_id:
                spans = t.get("spans", [])
                break
    if not spans:
        raise HTTPException(status_code=404, detail="Trace not found")

    total_duration = sum(s.get("duration_ms", 0) for s in spans)
    return {
        "trace_id": trace_id,
        "spans": spans,
        "total_duration_ms": round(total_duration, 2),
        "waterfall": sorted(spans, key=lambda x: x.get("timestamp", "")),
    }
