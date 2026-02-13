"""
Browser monitoring ingest endpoint - receives Web Vitals, errors, and timing from browser SDK
"""
import logging
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from shared.models.observability import BrowserEvent

logger = logging.getLogger(__name__)

router = APIRouter()


class WebVitalsEvent(BaseModel):
    """Web Vitals metric event"""
    name: str  # LCP, FID, CLS, FCP, TTFB
    value: float
    rating: Optional[str] = None
    delta: Optional[float] = None
    id: Optional[str] = None


class ErrorEvent(BaseModel):
    """JS error event"""
    message: str
    filename: Optional[str] = None
    lineno: Optional[int] = None
    colno: Optional[int] = None
    stack: Optional[str] = None
    type: Optional[str] = None  # error, unhandledrejection


class PageLoadEvent(BaseModel):
    """Page load timing from Performance API"""
    dom_content_loaded: Optional[float] = None
    load_complete: Optional[float] = None
    first_paint: Optional[float] = None
    first_contentful_paint: Optional[float] = None


class XhrEvent(BaseModel):
    """AJAX/fetch timing event"""
    url: str
    method: str = "GET"
    duration_ms: Optional[float] = None
    status: Optional[int] = None
    success: Optional[bool] = None


class BrowserIngestPayload(BaseModel):
    """Batch payload from browser SDK - project_id and tenant_id injected by API gateway"""
    app_name: Optional[str] = None
    url: Optional[str] = None
    web_vitals: list[WebVitalsEvent] = []
    errors: list[ErrorEvent] = []
    page_load: Optional[PageLoadEvent] = None
    xhr_events: list[XhrEvent] = []


@router.post("/ingest")
async def ingest_browser(request: Request) -> dict[str, Any]:
    """Accept browser monitoring data from SDK. project_id and tenant_id from body (injected by gateway)."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required (injected by API gateway)")

    app_name = body.get("app_name", "")
    url = body.get("url", "")
    web_vitals = body.get("web_vitals", [])
    errors = body.get("errors", [])
    page_load = body.get("page_load")
    xhr_events = body.get("xhr_events", [])

    events_count = len(web_vitals) + len(errors) + (1 if page_load else 0) + len(xhr_events)

    @sync_to_async
    def _create():
        BrowserEvent.objects.create(
            project_id=project_id,
            tenant_id=tenant_id,
            app_name=app_name,
            url=url,
            web_vitals=web_vitals,
            errors=errors,
            page_load=page_load or {},
            xhr_events=xhr_events,
        )

    await _create()
    logger.debug("Ingested browser batch: %d vitals, %d errors", len(web_vitals), len(errors))
    return {"ingested": True, "events_count": events_count}


@router.get("/overview")
async def get_browser_overview(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> dict[str, Any]:
    """Get browser monitoring overview with Web Vitals averages."""
    from fastapi import HTTPException
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _overview():
        events = list(
            BrowserEvent.objects.filter(project_id=pid)
            .values("web_vitals", "errors", "page_load", "xhr_events")
        )
        vitals_sum = {"LCP": [], "FID": [], "CLS": [], "FCP": [], "TTFB": []}
        js_errors = 0
        page_loads = 0
        ajax_calls = 0
        for entry in events:
            for v in entry.get("web_vitals", []):
                name = v.get("name", "") if isinstance(v, dict) else getattr(v, "name", "")
                if name in vitals_sum:
                    val = v.get("value", 0) if isinstance(v, dict) else getattr(v, "value", 0)
                    vitals_sum[name].append(val)
            js_errors += len(entry.get("errors", []))
            if entry.get("page_load"):
                page_loads += 1
            ajax_calls += len(entry.get("xhr_events", []))
        web_vitals = {}
        for name, values in vitals_sum.items():
            if values:
                web_vitals[name] = {"avg": round(sum(values) / len(values), 2), "count": len(values)}
            else:
                web_vitals[name] = {"avg": 0, "count": 0}
        return {
            "web_vitals": web_vitals,
            "js_errors_total": js_errors,
            "page_loads_total": page_loads,
            "ajax_calls_total": ajax_calls,
            "total_events": len(events),
        }

    return await _overview()


@router.get("/page-loads")
async def get_page_loads(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list[dict[str, Any]]:
    """Get page load timing data."""
    from fastapi import HTTPException
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        events = list(
            BrowserEvent.objects.filter(project_id=pid)
            .values("url", "timestamp", "page_load")
            .order_by("-timestamp")[:200]
        )
        result = []
        for e in events:
            if e.get("page_load"):
                ts = e.get("timestamp")
                if isinstance(ts, datetime):
                    ts = ts.isoformat() + "Z" if ts.tzinfo else ts.isoformat() + "Z"
                result.append({
                    "url": e.get("url", "unknown"),
                    "timestamp": ts or "",
                    **e["page_load"],
                })
        return result

    return await _list()


@router.get("/errors")
async def get_browser_errors(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list[dict[str, Any]]:
    """Get JS errors from browser."""
    from fastapi import HTTPException
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        events = list(
            BrowserEvent.objects.filter(project_id=pid)
            .values("url", "timestamp", "errors")
            .order_by("-timestamp")[:100]
        )
        result = []
        for entry in events:
            ts = entry.get("timestamp")
            if isinstance(ts, datetime):
                ts = ts.isoformat() + "Z" if ts.tzinfo else ts.isoformat() + "Z"
            for err in entry.get("errors", []):
                result.append({
                    "url": entry.get("url", "unknown"),
                    "timestamp": ts or "",
                    **err,
                })
        return result[:100]

    return await _list()


@router.get("/ajax")
async def get_ajax_calls(
    request: Request,
    project_id: Optional[str] = Query(None),
) -> list[dict[str, Any]]:
    """Get AJAX/fetch timing data."""
    from fastapi import HTTPException
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(status_code=400, detail="project_id query param or X-Project-ID header required")

    @sync_to_async
    def _list():
        events = list(
            BrowserEvent.objects.filter(project_id=pid)
            .values("url", "timestamp", "xhr_events")
            .order_by("-timestamp")[:100]
        )
        result = []
        for entry in events:
            ts = entry.get("timestamp")
            if isinstance(ts, datetime):
                ts = ts.isoformat() + "Z" if ts.tzinfo else ts.isoformat() + "Z"
            for xhr in entry.get("xhr_events", []):
                result.append({
                    "page_url": entry.get("url", "unknown"),
                    "timestamp": ts or "",
                    **xhr,
                })
        return result[:100]

    return await _list()
