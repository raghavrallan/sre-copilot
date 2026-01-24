"""
Proxy endpoints to route requests to microservices
"""
from fastapi import APIRouter, Request, HTTPException, Depends, Header, Response
from typing import Optional
import httpx

from app.core.config import settings

router = APIRouter()


def forward_response_cookies(source_response: httpx.Response, target_response: Response):
    """Forward cookies from backend service to client"""
    if 'set-cookie' in source_response.headers:
        for cookie in source_response.headers.get_list('set-cookie'):
            target_response.headers.append('set-cookie', cookie)


def get_error_message(backend_response: httpx.Response, default: str = "Request failed") -> str:
    """Safely extract error message from backend response"""
    try:
        error_data = backend_response.json()
        if isinstance(error_data, dict):
            return error_data.get('detail', default)
        return str(error_data)
    except Exception:
        # If JSON parsing fails, return text or default
        return backend_response.text or default


async def get_current_user_from_token(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Get current user by verifying JWT token (supports both header and cookie)"""
    # Try to get token from Authorization header first
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    # If no header token, try to get from cookies
    if not token:
        token = request.cookies.get("access_token")

    if not token:
        return None

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.AUTH_SERVICE_URL}/verify",
                headers={"Authorization": f"Bearer {token}"}
            )
            if response.status_code == 200:
                return response.json()
            return None
    except Exception:
        return None


# Auth endpoints
@router.post("/auth/register")
async def register(request: Request, response: Response):
    """Proxy to auth service - register"""
    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        backend_response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/register",
            json=body
        )

        # Forward cookies from auth service to client
        forward_response_cookies(backend_response, response)

        return backend_response.json()


@router.post("/auth/login")
async def login(request: Request, response: Response):
    """Proxy to auth service - login"""
    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        backend_response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/login",
            json=body
        )
        if backend_response.status_code != 200:
            error_message = get_error_message(backend_response, "Login failed")
            raise HTTPException(status_code=backend_response.status_code, detail=error_message)

        # Forward cookies from auth service to client
        forward_response_cookies(backend_response, response)

        return backend_response.json()


@router.post("/auth/switch-project")
async def switch_project(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - switch project"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/switch-project",
            json=body,
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to switch project')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/auth/me")
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Proxy to auth service - get current user"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/me",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to get user info')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    """Proxy to auth service - refresh token"""
    # Forward cookies from request to backend
    cookies = request.cookies

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        backend_response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/refresh",
            cookies=cookies
        )

        if backend_response.status_code != 200:
            error_message = get_error_message(backend_response, 'Token refresh failed')
            raise HTTPException(status_code=backend_response.status_code, detail=error_message)

        # Forward new cookies to client
        forward_response_cookies(backend_response, response)

        return backend_response.json()


@router.post("/auth/logout")
async def logout(response: Response):
    """Proxy to auth service - logout"""
    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        backend_response = await client.post(f"{settings.AUTH_SERVICE_URL}/logout")

        # Forward cookie clearing to client
        forward_response_cookies(backend_response, response)

        return backend_response.json()


@router.get("/auth/ws-token")
async def get_websocket_token(request: Request):
    """Proxy to auth service - get WebSocket token"""
    # Forward cookies from request to backend
    cookies = request.cookies

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        backend_response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/ws-token",
            cookies=cookies
        )

        if backend_response.status_code != 200:
            error_message = get_error_message(backend_response, 'Failed to get WebSocket token')
            raise HTTPException(status_code=backend_response.status_code, detail=error_message)

        return backend_response.json()


# Project management endpoints
@router.get("/projects")
async def list_projects(authorization: Optional[str] = Header(None)):
    """Proxy to auth service - list projects"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/projects")
async def create_project(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - create project"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects",
            json=body,
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - get project"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.patch("/projects/{project_id}")
async def update_project(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - update project"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            json=body,
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - delete project"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}/members")
async def list_project_members(
    project_id: str,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - list project members"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/projects/{project_id}/members")
async def add_project_member(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - add project member"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members",
            json=body,
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.patch("/projects/{project_id}/members/{user_id}")
async def update_member_role(
    project_id: str,
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - update member role"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members/{user_id}",
            json=body,
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.delete("/projects/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: str,
    user_id: str,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - remove project member"""
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members/{user_id}",
            headers={"Authorization": authorization}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


# Incident endpoints
@router.get("/incidents")
async def list_incidents(
    skip: int = 0,
    limit: int = 10,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - list incidents"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents",
            params={"skip": skip, "limit": limit, "project_id": user["project_id"]}
        )
        return response.json()


@router.post("/incidents")
async def create_incident(
    request: Request,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - create incident"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    body["project_id"] = user["project_id"]

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.INCIDENT_SERVICE_URL}/incidents",
            json=body
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/incidents/{incident_id}")
async def get_incident(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get incident"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/incidents/{incident_id}/hypotheses")
async def get_hypotheses(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get hypotheses"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/hypotheses",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.patch("/incidents/{incident_id}/state")
async def update_incident_state(
    incident_id: str,
    request: Request,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - update incident state"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    state = body.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="State is required")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/state",
            params={"state": state, "project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/incidents/{incident_id}/workflow")
async def get_incident_workflow(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get workflow"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/workflow",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/incidents/{incident_id}/metrics")
async def get_incident_metrics(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get metrics"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/metrics",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


# Analytics endpoints
@router.get("/analytics/token-usage")
async def get_analytics_token_usage(
    user=Depends(get_current_user_from_token)
):
    """Proxy to AI service - get token usage analytics"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AI_SERVICE_URL}/analytics/token-usage",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/analytics/cost-summary")
async def get_analytics_cost_summary(
    days: int = 7,
    user=Depends(get_current_user_from_token)
):
    """Proxy to AI service - get cost summary analytics"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AI_SERVICE_URL}/analytics/cost-summary",
            params={"days": days, "project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/analytics/incident-metrics/{incident_id}")
async def get_analytics_incident_metrics(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to AI service - get incident-specific analytics"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AI_SERVICE_URL}/analytics/incident-metrics/{incident_id}",
            params={"project_id": user["project_id"]}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()
