"""
Observability proxy endpoints - routes to metrics, logs, traces, alerts, synthetics, security, and AI services
"""
from fastapi import APIRouter, Request, HTTPException, Depends
import httpx

from app.core.config import settings
from app.api.proxy import get_internal_headers, get_error_message, get_current_user_from_token

router = APIRouter()


# Metrics/APM routes (proxy to metrics-collector-service)
@router.get("/metrics/services")
async def list_metrics_services(user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


# Metrics services-overview route (must be before /metrics/services/{service_name}/overview)
@router.get("/metrics/services-overview")
async def list_metrics_services_overview(user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - list services with overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services-overview",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/overview")
async def get_service_overview(service_name: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get service overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/overview",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/transactions")
async def get_service_transactions(service_name: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get service transactions"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/transactions",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/slow-transactions")
async def get_slow_transactions(service_name: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get slow transactions"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/slow-transactions",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/database-queries")
async def get_database_queries(service_name: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get database queries"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/database-queries",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/metrics/services/{service_name}/external-services")
async def get_external_services(service_name: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get external services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/services/{service_name}/external-services",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/traces/services/dependency-map")
async def get_traces_dependency_map(user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get traces dependency map"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/traces/services/dependency-map",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/traces/{trace_id}")
async def get_trace(trace_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get trace by ID"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/traces/{trace_id}",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/errors/groups/{fingerprint}")
async def get_error_group(fingerprint: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get error group"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/errors/groups/{fingerprint}",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}")
async def get_infrastructure_host(hostname: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get infrastructure host"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}/processes")
async def get_host_processes(hostname: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get host processes"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}/processes",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/infrastructure/hosts/{hostname}/containers")
async def get_host_containers(hostname: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get host containers"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/hosts/{hostname}/containers",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/deployments/{deployment_id}")
async def get_deployment(deployment_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get deployment"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/deployments/{deployment_id}",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/slos/{slo_id}")
async def get_slo(slo_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to metrics-collector - get SLO"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/slos/{slo_id}",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/logs/services")
async def list_log_services(user=Depends(get_current_user_from_token)):
    """Proxy to log-service - list log services"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.LOG_SERVICE_URL}/logs/services",
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
            params=dict(request.query_params),
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
            params=dict(request.query_params),
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/policies")
async def list_alert_policies(user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list alert policies"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/policies",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/channels")
async def list_alert_channels(user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list alert channels"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/channels",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/active-alerts")
async def list_active_alerts(user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list active (firing) alerts"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/active-alerts",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/alerts/muting-rules")
async def list_alert_muting_rules(user=Depends(get_current_user_from_token)):
    """Proxy to alerting-service - list muting rules"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.ALERTING_SERVICE_URL}/muting-rules",
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/synthetics/monitors/{monitor_id}")
async def get_synthetic_monitor(monitor_id: str, user=Depends(get_current_user_from_token)):
    """Proxy to synthetic-service - get monitor"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SYNTHETIC_SERVICE_URL}/monitors/{monitor_id}",
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
            params=dict(request.query_params),
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
            params=dict(request.query_params),
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/security/vulnerabilities/overview")
async def get_vulnerabilities_overview(user=Depends(get_current_user_from_token)):
    """Proxy to security-service - get vulnerabilities overview"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities/overview",
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
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities/{vuln_id}",
            json=body,
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
            params=dict(request.query_params),
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
            params=dict(request.query_params),
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
async def list_dashboards(user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str, user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/dashboards/{dashboard_id}",
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
async def get_browser_overview(user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/overview",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/page-loads")
async def get_browser_page_loads(user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/page-loads",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/errors")
async def get_browser_errors(user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/errors",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()


@router.get("/browser/ajax")
async def get_browser_ajax(user=Depends(get_current_user_from_token)):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.METRICS_COLLECTOR_URL}/browser/ajax",
            headers=get_internal_headers()
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=get_error_message(response, "Request failed"))
        return response.json()
