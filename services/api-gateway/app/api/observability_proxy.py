"""
Observability proxy endpoints - routes to metrics, logs, traces, alerts, synthetics, security, and AI services
"""
from fastapi import APIRouter, Request, HTTPException, Depends
from fastapi.responses import JSONResponse
import httpx

from app.core.config import settings
from app.api.proxy import get_internal_headers, get_error_message, get_current_user_from_token
from shared.utils.responses import validate_project_id

router = APIRouter()


def get_project_params(user: dict, extra_params: dict = None) -> dict:
    """Build params dict with project_id from user, merged with any extra query params.

    Raises HTTPException 400 if project_id is missing or empty.
    """
    params = dict(extra_params) if extra_params else {}
    pid = user.get("project_id", "")
    validate_project_id(pid, source="user context")
    params["project_id"] = pid
    return params


# Services registry (for onboarding verify step)
@router.get("/services/registry")
async def get_services_registry(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - services registry for project"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user, dict(request.query_params))
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/services/registry",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Metrics/APM routes (proxy to metrics-collector-service)
@router.get("/metrics/services")
async def list_metrics_services(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Metrics services-overview route (must be before /metrics/services/{service_name}/overview)
@router.get("/metrics/services-overview")
async def list_metrics_services_overview(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list services with overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services-overview",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/overview")
async def get_service_overview(service_name: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get service overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/overview",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/transactions")
async def get_service_transactions(service_name: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get service transactions"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/transactions",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/slow-transactions")
async def get_slow_transactions(service_name: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get slow transactions"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/slow-transactions",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/database-queries")
async def get_database_queries(service_name: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get database queries"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/database-queries",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/external-services")
async def get_external_services(service_name: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get external services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/external-services",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Traces routes
@router.get("/traces")
async def list_traces(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list traces"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/traces",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/traces/services/dependency-map")
async def get_traces_dependency_map(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get traces dependency map"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/traces/services/dependency-map",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get trace by ID"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/traces/{trace_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Errors routes
@router.get("/errors/groups")
async def list_error_groups(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list error groups"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/errors/groups",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/errors/groups/{fingerprint}")
async def get_error_group(fingerprint: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get error group"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/errors/groups/{fingerprint}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.patch("/errors/groups/{fingerprint}/triage")
async def triage_error_group(fingerprint: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - triage error group"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.METRICS_COLLECTOR_URL}/errors/groups/{fingerprint}/triage",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Infrastructure routes
@router.get("/infrastructure/hosts")
async def list_infrastructure_hosts(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list infrastructure hosts"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}")
async def get_infrastructure_host(hostname: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get infrastructure host"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}/processes")
async def get_host_processes(hostname: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get host processes"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}/processes",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}/containers")
async def get_host_containers(hostname: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get host containers"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}/containers",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Deployments routes
@router.post("/deployments")
async def create_deployment(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - create deployment"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/deployments",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/deployments")
async def list_deployments(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list deployments"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/deployments",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/deployments/{deployment_id}")
async def get_deployment(deployment_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get deployment"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/deployments/{deployment_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# SLOs routes
@router.post("/slos")
async def create_slo(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - create SLO"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/slos",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/slos")
async def list_slos(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list SLOs"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/slos",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/slos/{slo_id}")
async def get_slo(slo_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get SLO"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/slos/{slo_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.put("/slos/{slo_id}")
async def update_slo(slo_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - update SLO"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.put(
            f"{settings.METRICS_COLLECTOR_URL}/slos/{slo_id}",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.delete("/slos/{slo_id}")
async def delete_slo(slo_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - delete SLO"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.METRICS_COLLECTOR_URL}/slos/{slo_id}",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Log routes (proxy to log-service)
@router.get("/logs/search")
async def search_logs(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to log-service - search logs (forward query params)"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.LOG_SERVICE_URL}/logs/search",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/logs/services")
async def list_log_services(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to log-service - list log services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.LOG_SERVICE_URL}/logs/services",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/logs/stats")
async def get_log_stats(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to log-service - get log stats"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.LOG_SERVICE_URL}/logs/stats",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/logs/patterns")
async def get_log_patterns(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to log-service - get log patterns"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.LOG_SERVICE_URL}/logs/patterns",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Alert routes (proxy to alerting-service)
@router.post("/alerts/conditions")
async def create_alert_condition(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - create alert condition"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.ALERTING_SERVICE_URL}/conditions",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/conditions")
async def list_alert_conditions(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list alert conditions"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/conditions",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/policies")
async def list_alert_policies(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list alert policies"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/policies",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/channels")
async def list_alert_channels(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list alert channels"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/channels",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/active-alerts")
async def list_active_alerts(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list active (firing) alerts"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/active-alerts",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/muting-rules")
async def list_alert_muting_rules(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list muting rules"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/muting-rules",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Synthetic routes (proxy to synthetic-service)
@router.post("/synthetics/monitors")
async def create_synthetic_monitor(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to synthetic-service - create monitor"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.SYNTHETIC_SERVICE_URL}/monitors",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/synthetics/monitors")
async def list_synthetic_monitors(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to synthetic-service - list monitors"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SYNTHETIC_SERVICE_URL}/monitors",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/synthetics/monitors/{monitor_id}")
async def get_synthetic_monitor(monitor_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to synthetic-service - get monitor"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SYNTHETIC_SERVICE_URL}/monitors/{monitor_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/synthetics/monitors/{monitor_id}/results")
async def get_synthetic_monitor_results(monitor_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to synthetic-service - get monitor results"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SYNTHETIC_SERVICE_URL}/monitors/{monitor_id}/results",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Security routes (proxy to security-service)
@router.get("/security/vulnerabilities")
async def list_security_vulnerabilities(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to security-service - list vulnerabilities"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/security/vulnerabilities/overview")
async def get_vulnerabilities_overview(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to security-service - get vulnerabilities overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities/overview",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.patch("/security/vulnerabilities/{vuln_id}")
async def update_vulnerability(vuln_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to security-service - update vulnerability"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    query_params = dict(request.query_params)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities/{vuln_id}",
            json=body,
            params=query_params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# AI/Anomaly routes (proxy to ai-service)
@router.get("/anomaly/active")
async def get_active_anomalies(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to ai-service - get active anomalies"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AI_SERVICE_URL}/anomaly/active",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.post("/anomaly/detect")
async def detect_anomaly(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to ai-service - detect anomaly"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AI_SERVICE_URL}/anomaly/detect",
            json=body,
            params=get_project_params(user),
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/correlation/groups")
async def get_correlation_groups(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to ai-service - get correlation groups"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AI_SERVICE_URL}/correlation/groups",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Dashboard routes (proxy to metrics-collector-service)
@router.post("/dashboards")
async def create_dashboard(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards",
            json=body, headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/dashboards")
async def list_dashboards(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str, request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards/{dashboard_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.put("/dashboards/{dashboard_id}")
async def update_dashboard(dashboard_id: str, request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.put(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards/{dashboard_id}",
            json=body, headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.delete("/dashboards/{dashboard_id}")
async def delete_dashboard(dashboard_id: str, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards/{dashboard_id}",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Browser monitoring routes (proxy to metrics-collector-service)
@router.get("/browser/overview")
async def get_browser_overview(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/overview",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/page-loads")
async def get_browser_page_loads(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/page-loads",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/errors")
async def get_browser_errors(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/errors",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/ajax")
async def get_browser_ajax(request: Request, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/ajax",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# ---- Cloud Connections Proxy (cloud-connector-service) ----

@router.post("/connections")
async def create_cloud_connection(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - create cloud connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CLOUD_CONNECTOR_URL}/connections",
            json=body,
            params=get_project_params(user),
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/connections")
async def list_cloud_connections(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - list cloud connections"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CLOUD_CONNECTOR_URL}/connections",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.post("/connections/test")
async def test_cloud_connection(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - test connection without saving"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CLOUD_CONNECTOR_URL}/connections/test",
            json=body,
            params=get_project_params(user),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/connections/{connection_id}")
async def get_cloud_connection(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - get cloud connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CLOUD_CONNECTOR_URL}/connections/{connection_id}",
            params=get_project_params(user, dict(request.query_params)),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.patch("/connections/{connection_id}")
async def update_cloud_connection(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - update cloud connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.CLOUD_CONNECTOR_URL}/connections/{connection_id}",
            json=body,
            params=get_project_params(user),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.delete("/connections/{connection_id}")
async def delete_cloud_connection(connection_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to cloud-connector-service - delete cloud connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.CLOUD_CONNECTOR_URL}/connections/{connection_id}",
            params=get_project_params(user),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# ---- API Key Management Proxy (JWT-authenticated) ----

@router.post("/projects/{project_id}/api-keys")
async def create_api_key(project_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to auth service - create API key"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    token = request.headers.get("authorization", "")
    if not token:
        token = f"Bearer {request.cookies.get('access_token', '')}"
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/api-keys",
            json=body,
            headers={"Authorization": token}
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/projects/{project_id}/api-keys")
async def list_api_keys(project_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to auth service - list API keys"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = request.headers.get("authorization", "")
    if not token:
        token = f"Bearer {request.cookies.get('access_token', '')}"
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/api-keys",
            headers={"Authorization": token}
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.patch("/projects/{project_id}/api-keys/{key_id}")
async def update_api_key(project_id: str, key_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to auth service - update API key"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    token = request.headers.get("authorization", "")
    if not token:
        token = f"Bearer {request.cookies.get('access_token', '')}"
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/api-keys/{key_id}",
            json=body,
            headers={"Authorization": token}
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.delete("/projects/{project_id}/api-keys/{key_id}")
async def revoke_api_key(project_id: str, key_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to auth service - revoke API key"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = request.headers.get("authorization", "")
    if not token:
        token = f"Bearer {request.cookies.get('access_token', '')}"
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/api-keys/{key_id}",
            headers={"Authorization": token}
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return {"status": "deleted"}


# ---- CI/CD Connector Proxy (cicd-connector-service) ----
# CRUD, test, pipelines, runs - JWT auth required

@router.post("/cicd/connections")
async def create_cicd_connection(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - create CI/CD connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    params = get_project_params(user)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CICD_CONNECTOR_URL}/connections",
            json=body,
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code not in (200, 201):
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/cicd/connections")
async def list_cicd_connections(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - list CI/CD connections"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user, dict(request.query_params))
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CICD_CONNECTOR_URL}/connections",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/cicd/connections/{connection_id}")
async def get_cicd_connection(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - get CI/CD connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user, dict(request.query_params))
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CICD_CONNECTOR_URL}/connections/{connection_id}",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.patch("/cicd/connections/{connection_id}")
async def update_cicd_connection(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - update CI/CD connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    params = get_project_params(user)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.CICD_CONNECTOR_URL}/connections/{connection_id}",
            json=body,
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.delete("/cicd/connections/{connection_id}")
async def delete_cicd_connection(connection_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - delete CI/CD connection"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.CICD_CONNECTOR_URL}/connections/{connection_id}",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.post("/cicd/connections/test")
async def test_cicd_connection(request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - test connection without saving"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    body = await request.json()
    params = get_project_params(user)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CICD_CONNECTOR_URL}/connections/test",
            json=body,
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/cicd/connections/{connection_id}/pipelines")
async def list_cicd_pipelines(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - list pipelines/repos"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user, dict(request.query_params))
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CICD_CONNECTOR_URL}/connections/{connection_id}/pipelines",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/cicd/connections/{connection_id}/runs")
async def list_cicd_runs(connection_id: str, request: Request, user=Depends(get_current_user_from_token)):
    """Proxy to cicd-connector-service - list pipelines/workflow runs"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    params = get_project_params(user, dict(request.query_params))
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.CICD_CONNECTOR_URL}/connections/{connection_id}/runs",
            params=params,
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# ---- CI/CD Webhooks (NO JWT auth - use webhook_secret) ----

def _webhook_response(response: httpx.Response):
    """Build JSON response from upstream webhook response."""
    try:
        content = response.json()
    except Exception:
        content = {"detail": response.text or f"HTTP {response.status_code}"}
    return JSONResponse(status_code=response.status_code, content=content)


@router.post("/cicd/webhooks/{connection_id}/github")
async def cicd_webhook_github(connection_id: str, request: Request):
    """Proxy to cicd-connector-service - GitHub webhook. No JWT; validated by webhook_secret."""
    body = await request.body()
    headers = dict(request.headers)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CICD_CONNECTOR_URL}/webhooks/{connection_id}/github",
            content=body,
            headers={k: v for k, v in headers.items() if k.lower() in ("x-hub-signature-256", "x-github-event", "content-type")},
        )
        return _webhook_response(response)


@router.post("/cicd/webhooks/{connection_id}/azure-devops")
async def cicd_webhook_azure_devops(connection_id: str, request: Request):
    """Proxy to cicd-connector-service - Azure DevOps webhook. No JWT; validated by webhook_secret."""
    body = await request.json()
    headers = dict(request.headers)
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CICD_CONNECTOR_URL}/webhooks/{connection_id}/azure-devops",
            json=body,
            headers={k: v for k, v in headers.items() if k.lower() in ("x-webhook-secret", "content-type")},
        )
        return _webhook_response(response)


@router.post("/cicd/webhooks/generic/{project_id}")
async def cicd_webhook_generic(project_id: str, request: Request):
    """Proxy to cicd-connector-service - Generic webhook. No JWT; optional X-Webhook-Secret."""
    body = await request.json()
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.CICD_CONNECTOR_URL}/webhooks/generic/{project_id}",
            json=body,
            headers=dict(request.headers),
        )
        return _webhook_response(response)
