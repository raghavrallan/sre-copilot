"""
Health check endpoints
"""
from fastapi import APIRouter, HTTPException
from datetime import datetime
import httpx

from app.core.config import settings

router = APIRouter()


@router.get("/")
async def health_check():
    """Basic health check"""
    return {
        "status": "healthy",
        "service": "api-gateway",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/services")
async def services_health():
    """Check health of all microservices"""
    services = {
        "auth": settings.AUTH_SERVICE_URL,
        "incident": settings.INCIDENT_SERVICE_URL,
        "ai": settings.AI_SERVICE_URL,
        "integration": settings.INTEGRATION_SERVICE_URL
    }

    health_status = {}

    async with httpx.AsyncClient(timeout=5.0) as client:
        for service_name, service_url in services.items():
            try:
                response = await client.get(f"{service_url}/health")
                if response.status_code == 200:
                    health_status[service_name] = {
                        "status": "healthy",
                        "response_time_ms": int(response.elapsed.total_seconds() * 1000)
                    }
                else:
                    health_status[service_name] = {
                        "status": "unhealthy",
                        "error": f"Status code: {response.status_code}"
                    }
            except Exception as e:
                health_status[service_name] = {
                    "status": "unreachable",
                    "error": str(e)
                }

    # Determine overall health
    all_healthy = all(s.get("status") == "healthy" for s in health_status.values())

    return {
        "status": "healthy" if all_healthy else "degraded",
        "services": health_status,
        "timestamp": datetime.utcnow().isoformat()
    }
