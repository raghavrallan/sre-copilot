"""
Browser monitoring ingest endpoint - receives Web Vitals, errors, and timing from browser SDK
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.demo_data import generate_demo_browser_data

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory store for browser events (append-only for now)
browser_events: list[dict[str, Any]] = []

_demo_browser_data: list[dict[str, Any]] = []


def _ensure_browser_data():
    global _demo_browser_data
    if not browser_events and not _demo_browser_data:
        _demo_browser_data = generate_demo_browser_data()


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
    """Batch payload from browser SDK"""
    app_name: Optional[str] = None
    url: Optional[str] = None
    web_vitals: list[WebVitalsEvent] = []
    errors: list[ErrorEvent] = []
    page_load: Optional[PageLoadEvent] = None
    xhr_events: list[XhrEvent] = []


@router.post("/ingest")
async def ingest_browser(payload: BrowserIngestPayload) -> dict[str, Any]:
    """Accept browser monitoring data from SDK."""
    from datetime import datetime
    ts = datetime.utcnow().isoformat() + "Z"
    entry = {
        "timestamp": ts,
        "app_name": payload.app_name,
        "url": payload.url,
        "web_vitals": [v.model_dump() for v in payload.web_vitals],
        "errors": [e.model_dump() for e in payload.errors],
        "page_load": payload.page_load.model_dump() if payload.page_load else None,
        "xhr_events": [x.model_dump() for x in payload.xhr_events],
    }
    browser_events.append(entry)
    browser_events[:] = browser_events[-1000:]  # Keep last 1000 batches
    logger.debug("Ingested browser batch: %d vitals, %d errors", len(payload.web_vitals), len(payload.errors))
    return {"ingested": True, "events_count": len(payload.web_vitals) + len(payload.errors) + (1 if payload.page_load else 0) + len(payload.xhr_events)}


@router.get("/overview")
async def get_browser_overview() -> dict[str, Any]:
    """Get browser monitoring overview with Web Vitals averages."""
    _ensure_browser_data()
    data = browser_events if browser_events else _demo_browser_data

    vitals_sum = {"LCP": [], "FID": [], "CLS": [], "FCP": [], "TTFB": []}
    js_errors = 0
    page_loads = 0
    ajax_calls = 0

    for entry in data:
        for v in entry.get("web_vitals", []):
            name = v.get("name", "")
            if name in vitals_sum:
                vitals_sum[name].append(v.get("value", 0))
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
        "total_events": len(data),
    }


@router.get("/page-loads")
async def get_page_loads() -> list[dict[str, Any]]:
    """Get page load timing data."""
    _ensure_browser_data()
    data = browser_events if browser_events else _demo_browser_data

    result = []
    for entry in data:
        if entry.get("page_load"):
            result.append({
                "url": entry.get("url", "unknown"),
                "timestamp": entry.get("timestamp", ""),
                **entry["page_load"],
            })
    return result[:100]


@router.get("/errors")
async def get_browser_errors() -> list[dict[str, Any]]:
    """Get JS errors from browser."""
    _ensure_browser_data()
    data = browser_events if browser_events else _demo_browser_data

    result = []
    for entry in data:
        for err in entry.get("errors", []):
            result.append({
                "url": entry.get("url", "unknown"),
                "timestamp": entry.get("timestamp", ""),
                **err,
            })
    return result[:100]


@router.get("/ajax")
async def get_ajax_calls() -> list[dict[str, Any]]:
    """Get AJAX/fetch timing data."""
    _ensure_browser_data()
    data = browser_events if browser_events else _demo_browser_data

    result = []
    for entry in data:
        for xhr in entry.get("xhr_events", []):
            result.append({
                "page_url": entry.get("url", "unknown"),
                "timestamp": entry.get("timestamp", ""),
                **xhr,
            })
    return result[:100]
