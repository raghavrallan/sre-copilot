"""
Distributed tracing endpoints
"""
import logging
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import Trace, Span, ServiceRegistration

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
    """Trace ingest request with spans - project_id and tenant_id injected by API gateway"""
    spans: list[SpanModel]
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


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
async def ingest_traces(request: Request) -> dict[str, Any]:
    """Accept spans for distributed tracing. project_id and tenant_id from body (injected by gateway)."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required (injected by API gateway)")

    spans_data = body.get("spans", [])
    now = timezone.now()

    @sync_to_async
    def _ingest():
        trace_ids = set()
        for span in spans_data:
            trace_id = span.get("trace_id")
            trace_ids.add(trace_id)
            ts_str = span.get("timestamp")
            ts = now
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            Span.objects.create(
                project_id=project_id,
                tenant_id=tenant_id,
                trace_id=trace_id,
                span_id=span.get("span_id", ""),
                parent_span_id=span.get("parent_span_id") or "",
                service_name=span.get("service_name", ""),
                operation=span.get("operation", ""),
                duration_ms=float(span.get("duration_ms", 0)),
                status=span.get("status", "ok"),
                attributes=span.get("attributes", {}),
                events=span.get("events", []),
                timestamp=ts,
            )
        # Create/update Trace records
        for tid in trace_ids:
            spans = list(
                Span.objects.filter(project_id=project_id, trace_id=tid).values(
                    "service_name", "duration_ms", "status", "timestamp"
                )
            )
            if not spans:
                continue
            total_duration = sum(s["duration_ms"] for s in spans)
            has_error = any(s.get("status") == "error" for s in spans)
            root = spans[0] if spans else {}
            Trace.objects.update_or_create(
                project_id=project_id,
                tenant_id=tenant_id,
                trace_id=tid,
                defaults={
                    "root_service": root.get("service_name", ""),
                    "root_operation": "",
                    "duration_ms": total_duration,
                    "span_count": len(spans),
                    "has_error": has_error,
                    "timestamp": root.get("timestamp", now),
                },
            )
        return list(trace_ids)

    trace_ids = await _ingest()

    for span in spans_data:
        svc = span.get("service_name")
        if svc:
            await _upsert_service_registration(project_id, tenant_id, svc)

    logger.info("Ingested %d spans for %d traces", len(spans_data), len(trace_ids))
    return {"ingested_spans": len(spans_data), "trace_ids": trace_ids}


@router.get("")
async def list_traces(
    request: Request,
    project_id: Optional[str] = Query(None),
    service: Optional[str] = Query(None),
    min_duration: Optional[float] = Query(None),
    max_duration: Optional[float] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """List traces with filters."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        qs = Trace.objects.filter(project_id=pid)
        if min_duration is not None:
            qs = qs.filter(duration_ms__gte=min_duration)
        if max_duration is not None:
            qs = qs.filter(duration_ms__lte=max_duration)
        if status == "error":
            qs = qs.filter(has_error=True)
        traces = list(qs.order_by("-timestamp")[:limit * 2])  # fetch extra for filtering
        result = []
        for t in traces:
            if service:
                span_services = set(
                    Span.objects.filter(project_id=pid, trace_id=t.trace_id)
                    .values_list("service_name", flat=True)
                    .distinct()
                )
                if service not in span_services:
                    continue
            if status and status != "error":
                span_statuses = set(
                    Span.objects.filter(project_id=pid, trace_id=t.trace_id)
                    .values_list("status", flat=True)
                )
                if status not in span_statuses:
                    continue
            span_count = Span.objects.filter(project_id=pid, trace_id=t.trace_id).count()
            result.append({
                "trace_id": t.trace_id,
                "duration_ms": round(t.duration_ms, 2),
                "service_count": len(set(
                    Span.objects.filter(project_id=pid, trace_id=t.trace_id)
                    .values_list("service_name", flat=True)
                )),
                "span_count": span_count,
            })
            if len(result) >= limit:
                break
        return result

    return await _list()


@router.get("/services/dependency-map")
async def get_service_dependency_map(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get service dependency map from trace data."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _map():
        spans = list(
            Span.objects.filter(project_id=pid)
            .values("trace_id", "span_id", "parent_span_id", "service_name")
            .order_by("trace_id")
        )
        edges = []
        span_by_trace = {}
        for s in spans:
            tid = s["trace_id"]
            if tid not in span_by_trace:
                span_by_trace[tid] = {}
            span_by_trace[tid][s["span_id"]] = s
        for tid, span_by_id in span_by_trace.items():
            for s in span_by_id.values():
                parent_id = s.get("parent_span_id")
                if parent_id and parent_id in span_by_id:
                    parent = span_by_id[parent_id]
                    child_svc = s.get("service_name")
                    parent_svc = parent.get("service_name")
                    if child_svc and parent_svc and child_svc != parent_svc:
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

    return await _map()


@router.get("/{trace_id}")
async def get_trace(
    trace_id: str,
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get all spans for a trace (waterfall data)."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _get():
        spans = list(
            Span.objects.filter(project_id=pid, trace_id=trace_id)
            .values(
                "trace_id", "span_id", "parent_span_id", "service_name",
                "operation", "duration_ms", "status", "attributes", "events", "timestamp"
            )
        )
        for s in spans:
            if isinstance(s.get("timestamp"), datetime):
                s["timestamp"] = s["timestamp"].isoformat() + "Z" if s["timestamp"].tzinfo else s["timestamp"].isoformat() + "Z"
        return spans

    spans = await _get()
    if not spans:
        raise HTTPException(status_code=404, detail="Trace not found")

    total_duration = sum(s.get("duration_ms", 0) for s in spans)
    return {
        "trace_id": trace_id,
        "spans": spans,
        "total_duration_ms": round(total_duration, 2),
        "waterfall": sorted(spans, key=lambda x: x.get("timestamp", "")),
    }
