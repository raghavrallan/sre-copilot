"""
Proxy endpoints to route requests to microservices
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Header
from typing import Optional
import httpx

from app.core.config import settings

router = APIRouter()


async def verify_token(authorization: Optional[str] = Header(None)):
    """Verify JWT token with auth service"""
    if not authorization:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/verify",
                headers={"Authorization": authorization}
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception:
        return None


# Auth endpoints
@router.post("/auth/register")
async def register(request: Request):
    """Proxy to auth service - register"""
    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/register",
            json=body
        )
        return response.json()


@router.post("/auth/login")
async def login(request: Request):
    """Proxy to auth service - login"""
    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/login",
            json=body
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


# Incident endpoints
@router.get("/incidents")
async def list_incidents(
    skip: int = 0,
    limit: int = 10,
    user=Depends(verify_token)
):
    """Proxy to incident service - list incidents"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents",
            params={"skip": skip, "limit": limit, "tenant_id": user["tenant_id"]}
        )
        return response.json()


@router.post("/incidents")
async def create_incident(
    request: Request,
    user=Depends(verify_token)
):
    """Proxy to incident service - create incident"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    body["tenant_id"] = user["tenant_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.INCIDENT_SERVICE_URL}/incidents",
            json=body
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    user=Depends(verify_token)
):
    """Proxy to incident service - get incident"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}",
            params={"tenant_id": user["tenant_id"]}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()


@router.get("/incidents/{incident_id}/hypotheses")
async def get_hypotheses(
    incident_id: str,
    user=Depends(verify_token)
):
    """Proxy to incident service - get hypotheses"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/hypotheses",
            params={"tenant_id": user["tenant_id"]}
        )
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.json())
        return response.json()
