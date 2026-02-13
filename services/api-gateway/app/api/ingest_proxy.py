"""
Ingest proxy endpoints - authenticated via X-API-Key header (not JWT).
These are public routes that external agents/SDKs call to send telemetry data.
Each request is authenticated by API key, which resolves to a project_id/tenant_id.
The project_id is injected into the payload before forwarding to internal services.
"""
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, Request, HTTPException, Header
import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ingest", tags=["Ingest"])

# ---- Redis cache for API key lookups ----

_redis_client = None


async def get_redis():
    """Lazy-init Redis connection for API key caching"""
    global _redis_client
    if _redis_client is None:
        try:
            import redis.asyncio as aioredis
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
            )
            await _redis_client.ping()
        except Exception as e:
            logger.warning(f"Redis not available for API key cache: {e}")
            _redis_client = None
    return _redis_client


# ---- API Key Authentication ----

async def validate_api_key(x_api_key: Optional[str] = Header(None)) -> dict:
    """
    Validate the X-API-Key header and return project context.
    Returns dict with project_id, tenant_id.
    Uses Redis cache for fast lookups.
    """
    if not x_api_key:
        raise HTTPException(status_code=401, detail="X-API-Key header is required")

    key_hash = hashlib.sha256(x_api_key.encode()).hexdigest()

    # Try Redis cache first
    redis = await get_redis()
    if redis:
        try:
            import json
            cached = await redis.get(f"apikey:{key_hash}")
            if cached:
                data = json.loads(cached)
                if data.get("valid"):
                    return data
                else:
                    raise HTTPException(status_code=401, detail="Invalid or inactive API key")
        except HTTPException:
            raise
        except Exception:
            pass  # Cache miss or error, fall through to DB

    # DB lookup via auth-service
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            response = await client.post(
                f"{settings.AUTH_SERVICE_URL}/internal/validate-api-key",
                json={"key_hash": key_hash},
                headers={"X-Internal-Service-Key": settings.INTERNAL_SERVICE_KEY} if settings.INTERNAL_SERVICE_KEY else {}
            )
            if response.status_code == 200:
                data = response.json()
                # Cache the result in Redis (TTL 5 minutes)
                if redis:
                    try:
                        import json
                        await redis.setex(f"apikey:{key_hash}", 300, json.dumps(data))
                    except Exception:
                        pass
                return data
            else:
                # Cache negative result briefly (30s)
                if redis:
                    try:
                        import json
                        await redis.setex(f"apikey:{key_hash}", 30, json.dumps({"valid": False}))
                    except Exception:
                        pass
                raise HTTPException(status_code=401, detail="Invalid or inactive API key")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error validating API key: {e}")
        raise HTTPException(status_code=503, detail="Authentication service unavailable")


def get_internal_headers() -> dict:
    """Internal service headers"""
    headers = {}
    if settings.INTERNAL_SERVICE_KEY:
        headers["X-Internal-Service-Key"] = settings.INTERNAL_SERVICE_KEY
    return headers


# ---- Ingest Endpoints ----

@router.post("/metrics")
async def ingest_metrics(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest metrics from user's Python SDK or custom integration"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    # Inject project context
    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/metrics/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/traces")
async def ingest_traces(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest distributed traces from user's instrumented services"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/traces/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/errors")
async def ingest_errors(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest error events from user's applications"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/errors/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/logs")
async def ingest_logs(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest log entries from user's applications"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.LOG_SERVICE_URL}/logs/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/infrastructure")
async def ingest_infrastructure(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest host/infrastructure metrics from user's infra agent"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/infrastructure/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/browser")
async def ingest_browser(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest browser/RUM data from user's browser SDK"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.METRICS_COLLECTOR_URL}/browser/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()


@router.post("/vulnerabilities")
async def ingest_vulnerabilities(request: Request, x_api_key: Optional[str] = Header(None)):
    """Ingest vulnerability scan results from user's security scanning"""
    api_context = await validate_api_key(x_api_key)
    body = await request.json()

    body["project_id"] = api_context["project_id"]
    body["tenant_id"] = api_context["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.SECURITY_SERVICE_URL}/vulnerabilities/ingest",
            json=body,
            headers=get_internal_headers()
        )
        if response.status_code >= 400:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
