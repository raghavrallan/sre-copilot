"""
Grafana Proxy API - fetches dashboards, panels, and metadata from
the user's Grafana instance via the stored MonitoringIntegration credentials.
"""
import logging
import math
import re
import statistics
import time
from typing import List, Optional

import httpx
from asgiref.sync import sync_to_async
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query
from fastapi.responses import Response
from pydantic import BaseModel

from app.api.proxy import get_current_user_from_token, get_internal_headers
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/grafana", tags=["Grafana"])

@sync_to_async
def _get_grafana_credentials(project_id: str):
    """Look up the active Grafana MonitoringIntegration for a project."""
    from shared.models.monitoring_integration import MonitoringIntegration

    integration = (
        MonitoringIntegration.objects
        .filter(project_id=project_id, integration_type="grafana")
        .exclude(status="error")
        .order_by("-is_primary", "-created_at")
        .first()
    )
    if not integration:
        return None

    url = integration.url.rstrip("/")
    api_key = ""
    username = integration.username or ""
    password = ""

    try:
        api_key = integration.get_api_key() or ""
    except Exception as e:
        logger.warning("Failed to decrypt Grafana API key: %s", e)

    try:
        password = integration.get_password() or ""
    except Exception as e:
        logger.warning("Failed to decrypt Grafana password: %s", e)

    return {
        "url": url,
        "api_key": api_key,
        "username": username,
        "password": password,
        "integration_id": str(integration.id),
        "name": integration.name,
    }


def _extract_token(request: Request, authorization: Optional[str] = None) -> str:
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return token


async def _require_grafana(request: Request, authorization: Optional[str] = Header(None)):
    """Dependency: resolve Grafana credentials or 404."""
    user = await get_current_user_from_token(request, authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    project_id = user.get("project_id") or user.get("current_project_id")
    if not project_id:
        raise HTTPException(status_code=400, detail="No project selected")

    creds = await _get_grafana_credentials(project_id)
    if not creds:
        raise HTTPException(status_code=404, detail="No Grafana integration configured for this project")

    return creds


def _grafana_auth(creds: dict) -> tuple[dict, Optional[httpx.BasicAuth]]:
    """Build headers and optional basic auth from credentials."""
    headers = {"Accept": "application/json"}
    auth = None
    if creds.get("api_key"):
        headers["Authorization"] = f"Bearer {creds['api_key']}"
    elif creds.get("username") and creds.get("password"):
        auth = httpx.BasicAuth(creds["username"], creds["password"])
    return headers, auth


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/dashboards")
async def list_dashboards(
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """List all dashboards from the user's Grafana instance."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    logger.info("Fetching Grafana dashboards from %s", url)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{url}/api/search", params={"type": "dash-db", "limit": 100}, headers=headers, auth=auth)
    except httpx.ConnectError as e:
        logger.error("Cannot connect to Grafana at %s: %s", url, e)
        raise HTTPException(status_code=502, detail=f"Cannot connect to Grafana at {url}. Ensure the URL is reachable from the server.")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail=f"Grafana at {url} timed out")
    except Exception as e:
        logger.error("Grafana request failed: %s", e)
        raise HTTPException(status_code=502, detail=f"Grafana request failed: {str(e)}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Grafana returned {resp.status_code}: {resp.text[:300]}")

    raw = resp.json()
    dashboards = []
    for d in raw:
        dashboards.append({
            "uid": d.get("uid"),
            "title": d.get("title"),
            "url": d.get("url"),
            "tags": d.get("tags", []),
            "type": d.get("type"),
            "folderTitle": d.get("folderTitle", "General"),
            "folderUid": d.get("folderUid"),
            "isStarred": d.get("isStarred", False),
        })

    return {
        "grafana_url": url,
        "grafana_name": creds["name"],
        "dashboards": dashboards,
    }


@router.get("/dashboards/{uid}")
async def get_dashboard(
    uid: str,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Fetch a single dashboard with all panel definitions."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{url}/api/dashboards/uid/{uid}", headers=headers, auth=auth)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Grafana: {e}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Dashboard not found in Grafana")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Grafana returned {resp.status_code}")

    data = resp.json()
    dash = data.get("dashboard", {})
    meta = data.get("meta", {})

    sections = []
    current_section = {"title": "", "collapsed": False, "panels": []}

    for p in dash.get("panels", []):
        if p.get("type") == "row":
            if current_section["panels"]:
                sections.append(current_section)
            current_section = {
                "title": p.get("title", ""),
                "collapsed": p.get("collapsed", False),
                "panels": [],
            }
            for inner in p.get("panels", []):
                current_section["panels"].append(_serialize_panel(inner))
            continue
        current_section["panels"].append(_serialize_panel(p))

    if current_section["panels"]:
        sections.append(current_section)

    all_panels = []
    for s in sections:
        all_panels.extend(s["panels"])

    return {
        "uid": dash.get("uid"),
        "title": dash.get("title"),
        "description": dash.get("description", ""),
        "tags": dash.get("tags", []),
        "timezone": dash.get("timezone", ""),
        "version": dash.get("version"),
        "folder": meta.get("folderTitle", "General"),
        "created": meta.get("created"),
        "updated": meta.get("updated"),
        "createdBy": meta.get("createdBy"),
        "updatedBy": meta.get("updatedBy"),
        "grafana_url": creds["url"],
        "panels": all_panels,
        "sections": sections,
    }


def _serialize_panel(p: dict) -> dict:
    targets = []
    for t in p.get("targets", []):
        targets.append({
            "expr": t.get("expr", t.get("rawSql", t.get("query", ""))),
            "legendFormat": t.get("legendFormat", ""),
            "refId": t.get("refId", ""),
            "datasource": t.get("datasource"),
        })

    return {
        "id": p.get("id"),
        "title": p.get("title", ""),
        "type": p.get("type", ""),
        "description": p.get("description", ""),
        "datasource": p.get("datasource"),
        "gridPos": p.get("gridPos", {}),
        "targets": targets,
        "thresholds": p.get("fieldConfig", {}).get("defaults", {}).get("thresholds"),
        "alert": p.get("alert"),
    }


@router.get("/dashboards/{uid}/panels/{panel_id}/render")
async def render_panel(
    uid: str,
    panel_id: int,
    request: Request,
    width: int = Query(600, ge=100, le=2000),
    height: int = Query(350, ge=100, le=1200),
    creds: dict = Depends(_require_grafana),
):
    """Proxy Grafana's server-side panel render (requires image-renderer plugin)."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    render_url = f"{url}/render/d-solo/{uid}"
    params = {
        "orgId": 1,
        "panelId": panel_id,
        "width": width,
        "height": height,
        "from": "now-6h",
        "to": "now",
        "theme": "light",
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(render_url, params=params, headers=headers, auth=auth)
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Cannot connect to Grafana render endpoint")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Grafana render timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"Grafana render returned {resp.status_code}. Image-renderer plugin may not be installed.",
        )

    ct = resp.headers.get("content-type", "image/png")
    return Response(content=resp.content, media_type=ct)


@router.get("/dashboards/{uid}/panels/{panel_id}/embed-url")
async def get_panel_embed_url(
    uid: str,
    panel_id: int,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Return the solo-panel embed URL for iframe embedding."""
    base = creds["url"]
    embed_url = f"{base}/d-solo/{uid}?panelId={panel_id}&theme=light"
    return {"embed_url": embed_url}


class QueryPanelRequest(BaseModel):
    dashboard_uid: str
    panel_id: int
    from_time: str = "now-6h"
    to_time: str = "now"
    max_data_points: int = 80


@router.post("/query-panel")
async def query_panel_data(
    body: QueryPanelRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Query actual metric data for a panel via Grafana's datasource proxy."""
    url = creds["url"]
    gfn_headers, gfn_auth = _grafana_auth(creds)

    async with httpx.AsyncClient(timeout=15) as client:
        try:
            resp = await client.get(
                f"{url}/api/dashboards/uid/{body.dashboard_uid}",
                headers=gfn_headers, auth=gfn_auth,
            )
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Cannot reach Grafana: {e}")

        if resp.status_code != 200:
            raise HTTPException(status_code=502, detail="Could not fetch dashboard")

        raw = resp.json()
        dash = raw.get("dashboard", {})

        panel = _find_panel(dash, body.panel_id)
        if not panel:
            raise HTTPException(status_code=404, detail="Panel not found")

        targets = panel.get("targets", [])
        if not targets:
            return {"series": [], "panel_type": panel.get("type", "unknown")}

        # Resolve template variables from dashboard templating
        var_map = _build_var_map(dash)

        # Fetch actual datasources so we can resolve ${ds_...} UIDs
        try:
            ds_resp = await client.get(f"{url}/api/datasources", headers=gfn_headers, auth=gfn_auth)
            all_datasources = ds_resp.json() if ds_resp.status_code == 200 else []
        except Exception:
            all_datasources = []

        # Note: we intentionally do NOT call _resolve_all_vars here.
        # All non-datasource template variables use =~".+" regex matching
        # which is more reliable than trying to pick specific label values
        # that may be stale or wrong.

        # Find the Prometheus datasource numeric ID for direct proxy queries
        prom_ds = next((d for d in all_datasources if d.get("type") == "prometheus"), None)
        if not prom_ds:
            return {"series": [], "panel_type": panel.get("type", "unknown")}
        prom_id = prom_ds["id"]

        # Resolve and execute each target query via Prometheus API directly
        import time
        now = int(time.time())
        start = now - 6 * 3600
        step = max(60, (6 * 3600) // body.max_data_points)

        all_series = []
        for idx, t in enumerate(targets):
            raw_expr = t.get("expr", "")
            expr = _resolve_expr(raw_expr, var_map)
            if not expr:
                continue
            ref_id = t.get("refId") or chr(65 + idx)

            try:
                qr = await client.get(
                    f"{url}/api/datasources/proxy/{prom_id}/api/v1/query_range",
                    params={"query": expr, "start": start, "end": now, "step": step},
                    headers=gfn_headers, auth=gfn_auth,
                    timeout=20,
                )
            except Exception:
                continue

            if qr.status_code != 200:
                continue

            prom_data = qr.json()
            if prom_data.get("status") != "success":
                continue

            for result in prom_data.get("data", {}).get("result", []):
                metric = result.get("metric", {})
                label_parts = [v for v in metric.values()]
                name = ", ".join(label_parts[:3]) if label_parts else ref_id

                datapoints = []
                for ts_val in result.get("values", []):
                    ts_ms = int(float(ts_val[0]) * 1000)
                    try:
                        v = float(ts_val[1])
                        if math.isfinite(v):
                            datapoints.append({"t": ts_ms, "v": round(v, 4)})
                    except (ValueError, TypeError):
                        pass

                if datapoints:
                    all_series.append({"name": name, "ref_id": ref_id, "data": datapoints})

    return {"series": all_series, "panel_type": panel.get("type", "unknown")}


def _build_var_map(dash: dict) -> dict:
    """Extract current values of all template variables from the dashboard.

    Variables set to "All" are marked with a __all_<name> flag so that
    _resolve_expr can switch the PromQL operator from = to =~ for them.
    """
    var_map = {}
    for v in dash.get("templating", {}).get("list", []):
        name = v.get("name", "")
        if not name:
            continue
        if v.get("type") == "datasource":
            var_map[f"__ds_type_{name}"] = v.get("query", "")
            current = v.get("current", {}).get("value", "")
            if current and not current.startswith("$"):
                var_map[name] = current
            continue

        # Always use regex match for label variables to avoid stale saved values.
        # Grafana dashboards may be saved with values that don't match
        # the currently running infrastructure.
        val = ".+"
        var_map[f"__all_{name}"] = True
        var_map[name] = val
    return var_map


def _resolve_datasource(ds: any, var_map: dict, all_datasources: list) -> dict:
    """Resolve template-variable datasource UIDs to actual UIDs."""
    if isinstance(ds, str):
        ds = {"uid": ds}
    if not isinstance(ds, dict):
        ds = {}

    uid = ds.get("uid", "")
    ds_type = ds.get("type", "")

    # If UID is a template variable like ${ds_prometheus}
    if uid.startswith("${") and uid.endswith("}"):
        var_name = uid[2:-1]
        # Check if we have a resolved value
        if var_name in var_map:
            ds["uid"] = var_map[var_name]
            return ds
        # Try to find the datasource type from the variable definition
        actual_type = var_map.get(f"__ds_type_{var_name}", ds_type)
        for ads in all_datasources:
            if ads.get("type") == actual_type or ads.get("typeName", "").lower() == actual_type:
                ds["uid"] = ads["uid"]
                ds["type"] = ads["type"]
                return ds
    elif uid.startswith("$"):
        var_name = uid[1:]
        if var_name in var_map:
            ds["uid"] = var_map[var_name]
            return ds

    # If UID is still templated and we have a type, find by type
    if not uid or uid.startswith("$"):
        for ads in all_datasources:
            if ads.get("type") == ds_type:
                ds["uid"] = ads["uid"]
                ds["type"] = ads["type"]
                return ds
        # Fallback: pick the first Prometheus datasource
        for ads in all_datasources:
            if ads.get("type") == "prometheus":
                ds["uid"] = ads["uid"]
                ds["type"] = "prometheus"
                return ds

    return ds


_BUILTINS = {
    "__rate_interval": "5m",
    "__interval": "1m",
    "__interval_ms": "60000",
    "__range": "6h",
    "__range_s": "21600",
    "__range_ms": "21600000",
}

def _resolve_expr(expr: str, var_map: dict) -> str:
    """Replace Grafana template variables in a PromQL expression.

    For variables that were set to "All" (flagged in var_map), we also
    convert the PromQL selector operator from ``=`` to ``=~`` so the
    regex pattern actually works.
    """
    if not expr:
        return expr

    # 1. Replace built-in variables first
    for bi, bv in _BUILTINS.items():
        expr = expr.replace("${" + bi + "}", bv)
        expr = expr.replace("$" + bi, bv)

    # 2. For "All" variables, fix the operator AND substitute the value.
    #    Pattern: label_name="$var" or label_name="${var}"  ->  label_name=~".+"
    all_vars = {k[6:] for k in var_map if k.startswith("__all_")}
    for vname in all_vars:
        val = var_map.get(vname, ".+")
        # Handle: ='$var', ="${var}", ="$var", ='${var}'
        pat = re.compile(
            r"""(\w+)\s*=\s*(?:"|')?\$\{?""" + re.escape(vname) + r"""\}?(?:"|')?"""
        )
        expr = pat.sub(rf'\1=~"{val}"', expr)

    # 3. Substitute remaining (non-All) variables
    def _sub(m):
        name = m.group(1) or m.group(2)
        if name in _BUILTINS or name.startswith("__"):
            return m.group(0)
        if name in var_map:
            return var_map[name]
        return m.group(0)

    expr = re.compile(r'\$\{(\w+)\}|\$(\w+)').sub(_sub, expr)
    return expr


async def _resolve_all_vars(
    dash: dict, var_map: dict, all_datasources: list,
    url: str, headers: dict, auth, client: httpx.AsyncClient,
):
    """For variables still flagged as 'All' (no saved options), try to
    fetch a concrete first-value from Prometheus label values so the
    queries actually return data."""
    prom_ds = next((d for d in all_datasources if d.get("type") == "prometheus"), None)
    if not prom_ds:
        return

    prom_id = prom_ds.get("id")

    for v in dash.get("templating", {}).get("list", []):
        name = v.get("name", "")
        if not name or f"__all_{name}" not in var_map:
            continue

        # Try to parse the variable's query to figure out the label name.
        # Common patterns: "label_values(metric, label)" or "label_values(label)"
        vquery = v.get("query", "")
        if isinstance(vquery, dict):
            vquery = vquery.get("query", "")

        label_name = None
        m = re.match(r'label_values\(\s*\w+\s*,\s*(\w+)\s*\)', vquery)
        if m:
            label_name = m.group(1)
        else:
            m2 = re.match(r'label_values\(\s*(\w+)\s*\)', vquery)
            if m2:
                label_name = m2.group(1)

        if not label_name:
            continue

        try:
            lv_resp = await client.get(
                f"{url}/api/datasources/proxy/{prom_id}/api/v1/label/{label_name}/values",
                headers=headers, auth=auth,
            )
            if lv_resp.status_code == 200:
                values = lv_resp.json().get("data", [])
                if values:
                    var_map[name] = values[0]
                    del var_map[f"__all_{name}"]
                    print(f"[grafana] Resolved ${name} -> {values[0]} (from {len(values)} label values)", flush=True)
        except Exception as e:
            print(f"[grafana] Failed to resolve ${name}: {e}", flush=True)


def _find_panel(dash: dict, panel_id: int) -> Optional[dict]:
    for p in dash.get("panels", []):
        if p.get("id") == panel_id:
            return p
        if p.get("type") == "row":
            for inner in p.get("panels", []):
                if inner.get("id") == panel_id:
                    return inner
    return None


def _parse_ds_query_response(result: dict) -> list:
    """Convert Grafana ds/query response into a simple list of series."""
    series = []
    for ref_id, ref_data in result.get("results", {}).items():
        frames = ref_data.get("frames", [])
        for frame in ref_data.get("frames", []):
            schema = frame.get("schema", {})
            data = frame.get("data", {})
            fields = schema.get("fields", [])
            values = data.get("values", [])

            if len(fields) < 2 or len(values) < 2:
                continue

            timestamps = values[0]
            for fi in range(1, len(fields)):
                if fi >= len(values):
                    break
                metric_vals = values[fi]
                field = fields[fi]

                label_parts = []
                labels = field.get("labels", {})
                if labels:
                    label_parts = [f"{v}" for v in labels.values()]
                name = ", ".join(label_parts) if label_parts else field.get("name", ref_id)

                datapoints = []
                for ti, ts in enumerate(timestamps):
                    v = metric_vals[ti] if ti < len(metric_vals) else None
                    if v is not None:
                        if isinstance(v, float) and not math.isfinite(v):
                            continue
                        datapoints.append({"t": ts, "v": round(v, 4) if isinstance(v, float) else v})

                if datapoints:
                    series.append({"name": name, "ref_id": ref_id, "data": datapoints})

    return series


class AnalyzeRequest(BaseModel):
    dashboard_uid: str
    panel_ids: Optional[list] = None


@router.post("/analyze")
async def analyze_dashboard(
    body: AnalyzeRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Fetch dashboard metadata and send it to the AI service for analysis."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(f"{url}/api/dashboards/uid/{body.dashboard_uid}", headers=headers, auth=auth)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach Grafana: {e}")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Could not fetch dashboard from Grafana")

    data = resp.json()
    dash = data.get("dashboard", {})

    panels_for_ai = []
    for p in dash.get("panels", []):
        if p.get("type") == "row":
            for inner in p.get("panels", []):
                panels_for_ai.append(_panel_summary(inner))
            continue
        panels_for_ai.append(_panel_summary(p))

    if body.panel_ids:
        panels_for_ai = [p for p in panels_for_ai if p["id"] in body.panel_ids]

    # Also try to fetch active Grafana alerts
    alerts = []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            alert_resp = await client.get(f"{url}/api/alerts", headers=headers, auth=auth)
            if alert_resp.status_code == 200:
                for a in alert_resp.json():
                    if a.get("dashboardUid") == body.dashboard_uid:
                        alerts.append({
                            "name": a.get("name"),
                            "state": a.get("state"),
                            "panelId": a.get("panelId"),
                        })
    except Exception:
        pass

    # Send to AI service
    ai_payload = {
        "dashboard_title": dash.get("title", "Unknown"),
        "dashboard_description": dash.get("description", ""),
        "panels": panels_for_ai,
        "alerts": alerts,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            ai_resp = await client.post(
                f"{settings.AI_SERVICE_URL}/analyze-dashboard",
                json=ai_payload,
            )
            if ai_resp.status_code == 200:
                return ai_resp.json()
            logger.warning("AI service returned %s: %s", ai_resp.status_code, ai_resp.text[:200])
    except Exception as e:
        logger.warning("AI service unreachable: %s", e)

    return _fallback_analysis(ai_payload)


def _panel_summary(p: dict) -> dict:
    queries = []
    for t in p.get("targets", []):
        expr = t.get("expr", t.get("rawSql", t.get("query", "")))
        if expr:
            queries.append(expr)
    return {
        "id": p.get("id"),
        "title": p.get("title", "Untitled"),
        "type": p.get("type", "unknown"),
        "queries": queries,
        "has_alert": bool(p.get("alert")),
        "thresholds": p.get("fieldConfig", {}).get("defaults", {}).get("thresholds"),
    }


async def _get_prom_datasource(url: str, headers: dict, auth) -> Optional[dict]:
    """Find the first Prometheus datasource from Grafana."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(f"{url}/api/datasources", headers=headers, auth=auth)
            if resp.status_code == 200:
                for ds in resp.json():
                    if ds.get("type") == "prometheus":
                        return ds
    except Exception:
        pass
    return None


async def _query_prometheus_raw(
    url: str, headers: dict, auth, prom_id: int,
    expr: str, start: int, end: int, step: int,
) -> list:
    """Execute a PromQL query_range via Grafana datasource proxy and return raw results."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{url}/api/datasources/proxy/{prom_id}/api/v1/query_range",
                params={"query": expr, "start": start, "end": end, "step": step},
                headers=headers, auth=auth,
            )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("status") == "success":
                    return data.get("data", {}).get("result", [])
    except Exception as e:
        logger.warning("Prometheus query failed for expr=%s: %s", expr[:80], e)
    return []


def _prom_results_to_series(results: list, ref_id: str = "A") -> list:
    """Convert Prometheus query_range results to our standard series format."""
    series = []
    for result in results:
        metric = result.get("metric", {})
        label_parts = list(metric.values())
        name = ", ".join(label_parts[:3]) if label_parts else ref_id
        datapoints = []
        for ts_val in result.get("values", []):
            ts_ms = int(float(ts_val[0]) * 1000)
            try:
                v = float(ts_val[1])
                if math.isfinite(v):
                    datapoints.append({"t": ts_ms, "v": round(v, 4)})
            except (ValueError, TypeError):
                pass
        if datapoints:
            series.append({"name": name, "ref_id": ref_id, "data": datapoints})
    return series


# ---------------------------------------------------------------------------
# Phase 1a: Arbitrary PromQL Query Endpoint
# ---------------------------------------------------------------------------

class PromQLRequest(BaseModel):
    expr: str
    from_time: str = "now-1h"
    to_time: str = "now"
    step: int = 60
    max_data_points: int = 120


def _parse_relative_time(s: str) -> int:
    """Convert Grafana-style relative time to epoch seconds."""
    now = int(time.time())
    if s == "now":
        return now
    m = re.match(r"now-(\d+)([smhdw])", s)
    if m:
        val, unit = int(m.group(1)), m.group(2)
        multiplier = {"s": 1, "m": 60, "h": 3600, "d": 86400, "w": 604800}
        return now - val * multiplier.get(unit, 1)
    try:
        return int(float(s))
    except (ValueError, TypeError):
        return now - 3600


@router.post("/query")
async def query_promql(
    body: PromQLRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Execute an arbitrary PromQL query through Grafana's Prometheus datasource proxy."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    prom_ds = await _get_prom_datasource(url, headers, auth)
    if not prom_ds:
        raise HTTPException(status_code=404, detail="No Prometheus datasource found in Grafana")

    start = _parse_relative_time(body.from_time)
    end = _parse_relative_time(body.to_time)
    step = max(15, body.step)

    results = await _query_prometheus_raw(url, headers, auth, prom_ds["id"], body.expr, start, end, step)
    series = _prom_results_to_series(results, "A")
    return {"series": series, "query": body.expr}


# ---------------------------------------------------------------------------
# Phase 1b: Grafana Alert Rules Sync
# ---------------------------------------------------------------------------

@router.get("/alert-rules")
async def list_alert_rules(
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Fetch alert rules from Grafana's unified alerting provisioning API."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    rules = []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(
                f"{url}/api/v1/provisioning/alert-rules",
                headers=headers, auth=auth,
            )
            if resp.status_code == 200:
                for r in resp.json():
                    rules.append({
                        "uid": r.get("uid", ""),
                        "title": r.get("title", "Untitled"),
                        "condition": r.get("condition", ""),
                        "folder_uid": r.get("folderUID", ""),
                        "rule_group": r.get("ruleGroup", ""),
                        "for_duration": r.get("for", ""),
                        "labels": r.get("labels", {}),
                        "annotations": r.get("annotations", {}),
                        "is_paused": r.get("isPaused", False),
                    })
            elif resp.status_code == 404:
                # Unified alerting may not be enabled; try legacy API
                legacy = await client.get(f"{url}/api/alerts", headers=headers, auth=auth)
                if legacy.status_code == 200:
                    for a in legacy.json():
                        rules.append({
                            "uid": str(a.get("id", "")),
                            "title": a.get("name", "Untitled"),
                            "state": a.get("state", "unknown"),
                            "dashboard_uid": a.get("dashboardUid", ""),
                            "panel_id": a.get("panelId"),
                            "labels": {},
                            "annotations": {},
                            "is_paused": a.get("state") == "paused",
                        })
    except Exception as e:
        logger.warning("Failed to fetch alert rules from Grafana: %s", e)

    # Try to also get current alert instances for state information
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            inst_resp = await client.get(
                f"{url}/api/v1/provisioning/alert-rules",
                headers=headers, auth=auth,
            )
            # Also fetch prometheus alerts for state
            alerts_resp = await client.get(f"{url}/api/alerts", headers=headers, auth=auth)
            if alerts_resp.status_code == 200:
                state_map = {}
                for a in alerts_resp.json():
                    state_map[a.get("name", "")] = a.get("state", "")
                for rule in rules:
                    if rule["title"] in state_map:
                        rule["state"] = state_map[rule["title"]]
    except Exception:
        pass

    # Set default state for rules without one
    for rule in rules:
        if "state" not in rule:
            rule["state"] = "normal"

    firing_count = sum(1 for r in rules if r.get("state") in ("alerting", "firing", "pending"))

    return {
        "rules": rules,
        "total": len(rules),
        "firing": firing_count,
        "grafana_url": url,
    }


# ---------------------------------------------------------------------------
# Phase 1c: Multi-Metric Anomaly Scan
# ---------------------------------------------------------------------------

class DetectAnomaliesRequest(BaseModel):
    dashboard_uid: Optional[str] = None
    expressions: Optional[List[str]] = None
    sensitivity: float = 2.0
    from_time: str = "now-1h"
    to_time: str = "now"


def _zscore_detect(values: list[float], sensitivity: float = 2.0) -> list[dict]:
    """Run z-score anomaly detection on a list of values."""
    if len(values) < 5:
        return []
    anomalies = []
    mean_val = statistics.mean(values)
    std_val = statistics.stdev(values)
    if std_val == 0:
        return []
    for i, v in enumerate(values):
        z = abs(v - mean_val) / std_val
        if z > sensitivity:
            anomalies.append({
                "index": i,
                "value": round(v, 4),
                "expected": round(mean_val, 4),
                "z_score": round(z, 2),
                "severity": "critical" if z > sensitivity * 1.5 else "warning",
            })
    return anomalies


@router.post("/detect-anomalies")
async def detect_anomalies(
    body: DetectAnomaliesRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Scan multiple metrics for anomalies using z-score analysis."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    prom_ds = await _get_prom_datasource(url, headers, auth)
    if not prom_ds:
        raise HTTPException(status_code=404, detail="No Prometheus datasource found")

    start = _parse_relative_time(body.from_time)
    end = _parse_relative_time(body.to_time)
    step = max(60, (end - start) // 60)
    prom_id = prom_ds["id"]

    expressions_to_scan = []

    if body.expressions:
        expressions_to_scan = [{"expr": e, "panel_title": e[:60]} for e in body.expressions]
    elif body.dashboard_uid:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{url}/api/dashboards/uid/{body.dashboard_uid}",
                    headers=headers, auth=auth,
                )
                if resp.status_code == 200:
                    dash = resp.json().get("dashboard", {})
                    var_map = _build_var_map(dash)
                    for p in dash.get("panels", []):
                        if p.get("type") in ("row", "text"):
                            continue
                        for t in p.get("targets", []):
                            raw_expr = t.get("expr", "")
                            expr = _resolve_expr(raw_expr, var_map)
                            if expr:
                                expressions_to_scan.append({
                                    "expr": expr,
                                    "panel_title": p.get("title", ""),
                                    "panel_id": p.get("id"),
                                })
                        if p.get("type") == "row":
                            for inner in p.get("panels", []):
                                for t in inner.get("targets", []):
                                    raw_expr = t.get("expr", "")
                                    expr = _resolve_expr(raw_expr, var_map)
                                    if expr:
                                        expressions_to_scan.append({
                                            "expr": expr,
                                            "panel_title": inner.get("title", ""),
                                            "panel_id": inner.get("id"),
                                        })
        except Exception as e:
            logger.warning("Failed to load dashboard for anomaly scan: %s", e)

    if not expressions_to_scan:
        return {"anomalies": [], "scanned": 0}

    all_anomalies = []
    scanned = 0
    for item in expressions_to_scan[:20]:  # cap at 20 queries
        results = await _query_prometheus_raw(url, headers, auth, prom_id, item["expr"], start, end, step)
        scanned += 1
        for result in results:
            values = []
            for ts_val in result.get("values", []):
                try:
                    v = float(ts_val[1])
                    if math.isfinite(v):
                        values.append(v)
                except (ValueError, TypeError):
                    pass
            detected = _zscore_detect(values, body.sensitivity)
            if detected:
                metric = result.get("metric", {})
                metric_name = ", ".join(list(metric.values())[:2]) or item["expr"][:40]
                all_anomalies.append({
                    "panel_title": item.get("panel_title", ""),
                    "panel_id": item.get("panel_id"),
                    "metric_name": metric_name,
                    "expr": item["expr"][:120],
                    "anomaly_count": len(detected),
                    "max_severity": max(d["severity"] for d in detected),
                    "latest_value": detected[-1]["value"] if detected else None,
                    "expected_value": detected[-1]["expected"] if detected else None,
                    "details": detected[-3:],
                })

    all_anomalies.sort(key=lambda a: (0 if a["max_severity"] == "critical" else 1, -a["anomaly_count"]))

    return {
        "anomalies": all_anomalies,
        "scanned": scanned,
        "dashboard_uid": body.dashboard_uid,
    }


# ---------------------------------------------------------------------------
# Phase 1d: AI-Powered Incident Creation from Grafana
# ---------------------------------------------------------------------------

class CreateIncidentFromGrafanaRequest(BaseModel):
    metric_name: str
    expr: str = ""
    panel_title: str = ""
    dashboard_uid: str = ""
    panel_id: Optional[int] = None
    severity: str = "high"
    latest_value: Optional[float] = None
    expected_value: Optional[float] = None
    service_name: str = ""


@router.post("/create-incident")
async def create_incident_from_grafana(
    body: CreateIncidentFromGrafanaRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Create an incident from a Grafana anomaly, optionally using AI for title/description."""
    token = _extract_token(request)
    user = await get_current_user_from_token(request, request.headers.get("authorization"))
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    project_id = user.get("project_id") or user.get("current_project_id")

    deviation = ""
    if body.latest_value is not None and body.expected_value is not None:
        deviation = f"Current: {body.latest_value}, Expected: {body.expected_value}"

    title = f"Anomaly detected: {body.metric_name}"
    if body.panel_title:
        title = f"Anomaly in {body.panel_title}: {body.metric_name}"

    description = f"Automated incident from Grafana anomaly detection.\n\n"
    description += f"Metric: {body.metric_name}\n"
    if body.panel_title:
        description += f"Panel: {body.panel_title}\n"
    if body.dashboard_uid:
        description += f"Dashboard: {creds['url']}/d/{body.dashboard_uid}\n"
    if deviation:
        description += f"Deviation: {deviation}\n"
    if body.expr:
        description += f"Query: {body.expr[:200]}\n"

    # Try AI-enhanced title/description
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            ai_resp = await client.post(
                f"{settings.AI_SERVICE_URL}/generate-incident-from-anomaly",
                json={
                    "metric_name": body.metric_name,
                    "panel_title": body.panel_title,
                    "latest_value": body.latest_value,
                    "expected_value": body.expected_value,
                    "expr": body.expr[:200],
                    "service_name": body.service_name,
                },
            )
            if ai_resp.status_code == 200:
                ai_data = ai_resp.json()
                title = ai_data.get("title", title)
                description = ai_data.get("description", description)
                if ai_data.get("severity"):
                    body.severity = ai_data["severity"]
                if ai_data.get("service_name"):
                    body.service_name = ai_data["service_name"]
    except Exception as e:
        logger.info("AI incident generation unavailable, using defaults: %s", e)

    incident_payload = {
        "title": title,
        "description": description,
        "service_name": body.service_name or "unknown",
        "severity": body.severity,
        "project_id": project_id,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{settings.INCIDENT_SERVICE_URL}/incidents",
                json=incident_payload,
                headers=get_internal_headers(),
            )
            if resp.status_code in (200, 201):
                return {
                    "success": True,
                    "incident": resp.json(),
                    "grafana_context": {
                        "dashboard_uid": body.dashboard_uid,
                        "panel_id": body.panel_id,
                        "metric_name": body.metric_name,
                    },
                }
            else:
                raise HTTPException(status_code=resp.status_code, detail=resp.text[:300])
    except httpx.ConnectError:
        raise HTTPException(status_code=502, detail="Cannot reach incident service")


# ---------------------------------------------------------------------------
# Phase 1e: SLO PromQL Computation
# ---------------------------------------------------------------------------

class SLOQueryRequest(BaseModel):
    expr: str
    target_percentage: float = 99.9
    time_window_days: int = 30
    good_expr: Optional[str] = None
    total_expr: Optional[str] = None


@router.post("/slo-query")
async def query_slo_metrics(
    body: SLOQueryRequest,
    request: Request,
    creds: dict = Depends(_require_grafana),
):
    """Compute live SLO compliance from PromQL expressions."""
    url = creds["url"]
    headers, auth = _grafana_auth(creds)

    prom_ds = await _get_prom_datasource(url, headers, auth)
    if not prom_ds:
        raise HTTPException(status_code=404, detail="No Prometheus datasource found")

    now = int(time.time())
    window_seconds = body.time_window_days * 86400
    start = now - window_seconds
    step = max(300, window_seconds // 200)
    prom_id = prom_ds["id"]

    if body.good_expr and body.total_expr:
        good_results = await _query_prometheus_raw(url, headers, auth, prom_id, body.good_expr, start, now, step)
        total_results = await _query_prometheus_raw(url, headers, auth, prom_id, body.total_expr, start, now, step)

        good_vals = []
        for r in good_results:
            for ts_val in r.get("values", []):
                try:
                    v = float(ts_val[1])
                    if math.isfinite(v):
                        good_vals.append(v)
                except (ValueError, TypeError):
                    pass
        total_vals = []
        for r in total_results:
            for ts_val in r.get("values", []):
                try:
                    v = float(ts_val[1])
                    if math.isfinite(v):
                        total_vals.append(v)
                except (ValueError, TypeError):
                    pass

        good_sum = sum(good_vals) if good_vals else 0
        total_sum = sum(total_vals) if total_vals else 1
        compliance = (good_sum / total_sum * 100) if total_sum > 0 else 100.0
    else:
        results = await _query_prometheus_raw(url, headers, auth, prom_id, body.expr, start, now, step)
        all_values = []
        for r in results:
            for ts_val in r.get("values", []):
                try:
                    v = float(ts_val[1])
                    if math.isfinite(v):
                        all_values.append(v)
                except (ValueError, TypeError):
                    pass
        compliance = statistics.mean(all_values) if all_values else 100.0
        if compliance <= 1.0:
            compliance *= 100

    error_budget_total = 100.0 - body.target_percentage
    error_budget_consumed = max(0, 100.0 - compliance) if compliance <= 100 else 0
    error_budget_remaining = max(0, error_budget_total - error_budget_consumed)
    error_budget_remaining_pct = (error_budget_remaining / error_budget_total * 100) if error_budget_total > 0 else 100

    burn_rate = (error_budget_consumed / error_budget_total) if error_budget_total > 0 else 0

    series_data = _prom_results_to_series(
        await _query_prometheus_raw(url, headers, auth, prom_id, body.expr, start, now, step),
        "sli",
    )

    return {
        "compliance": round(compliance, 4),
        "target": body.target_percentage,
        "error_budget_remaining": round(error_budget_remaining_pct, 2),
        "burn_rate": round(burn_rate, 4),
        "time_window_days": body.time_window_days,
        "status": "meeting" if compliance >= body.target_percentage else ("breached" if error_budget_remaining_pct <= 0 else "at_risk"),
        "series": series_data,
    }


def _fallback_analysis(payload: dict) -> dict:
    """Basic rule-based analysis when the AI service is unavailable."""
    insights = []
    panel_count = len(payload.get("panels", []))
    alert_count = len(payload.get("alerts", []))
    firing = [a for a in payload.get("alerts", []) if a.get("state") in ("alerting", "pending")]

    if firing:
        insights.append({
            "severity": "critical",
            "title": f"{len(firing)} alert(s) currently firing",
            "description": ", ".join(a["name"] for a in firing),
            "recommendation": "Investigate the firing alerts immediately. Check the linked panels for root cause.",
        })

    for panel in payload.get("panels", []):
        for q in panel.get("queries", []):
            if "error" in q.lower() or "5xx" in q.lower() or "error_rate" in q.lower():
                insights.append({
                    "severity": "warning",
                    "title": f"Panel \"{panel['title']}\" tracks errors",
                    "description": f"Query: {q[:120]}",
                    "recommendation": "Check if error rates are within acceptable thresholds.",
                })
                break

    if not insights:
        insights.append({
            "severity": "info",
            "title": "Dashboard looks healthy",
            "description": f"Analyzed {panel_count} panels and {alert_count} alert rules. No immediate issues detected.",
            "recommendation": "Continue monitoring. Consider setting up alert rules for critical panels.",
        })

    return {
        "dashboard_title": payload.get("dashboard_title", ""),
        "summary": f"Analyzed {panel_count} panels, {alert_count} alert rules, {len(firing)} firing.",
        "insights": insights,
        "ai_powered": False,
    }
