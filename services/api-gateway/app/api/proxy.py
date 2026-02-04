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
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()
    project_id = body.get("project_id")

    if not project_id:
        raise HTTPException(status_code=400, detail="project_id is required")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/switch-project",
            params={"project_id": project_id},
            headers={"Authorization": f"Bearer {token}"}
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


# Helper function to get token from header or cookie
def get_token_from_request(request: Request, authorization: Optional[str] = None) -> Optional[str]:
    """Extract token from Authorization header or cookie"""
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token:
        token = request.cookies.get("access_token")
    return token


# Project management endpoints
@router.get("/projects")
async def list_projects(
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - list projects"""
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects",
            headers={"Authorization": f"Bearer {token}"}
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
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects",
            json=body,
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - get project"""
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            headers={"Authorization": f"Bearer {token}"}
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
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            json=body,
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.delete("/projects/{project_id}")
async def delete_project(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - delete project"""
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}/members")
async def list_project_members(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - list project members"""
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members",
            headers={"Authorization": f"Bearer {token}"}
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
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members",
            json=body,
            headers={"Authorization": f"Bearer {token}"}
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
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members/{user_id}",
            json=body,
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.delete("/projects/{project_id}/members/{user_id}")
async def remove_project_member(
    project_id: str,
    user_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - remove project member"""
    token = get_token_from_request(request, authorization)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/members/{user_id}",
            headers={"Authorization": f"Bearer {token}"}
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


# Incident endpoints
@router.get("/incidents")
async def list_incidents(
    page: int = 1,
    limit: int = 20,
    severity: Optional[str] = None,
    state: Optional[str] = None,
    search: Optional[str] = None,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - list incidents with pagination"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    params = {
        "page": page,
        "limit": limit,
        "project_id": user["project_id"]
    }
    if severity:
        params["severity"] = severity
    if state:
        params["state"] = state
    if search:
        params["search"] = search

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents",
            params=params
        )
        return response.json()


@router.get("/incidents-stats")
async def get_incidents_stats(
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get incident statistics"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents-stats",
            params={"project_id": user["project_id"]}
        )
        return response.json()


@router.get("/incidents-timeline")
async def get_incidents_timeline(
    days: int = 7,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get incident timeline for charts"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents-timeline",
            params={"project_id": user["project_id"], "days": days}
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

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/state",
            params={"project_id": user["project_id"]},
            json=body
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.patch("/incidents/{incident_id}/severity")
async def update_incident_severity(
    incident_id: str,
    request: Request,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - update incident severity"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/severity",
            params={"project_id": user["project_id"]},
            json=body
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/incidents/{incident_id}/comments")
async def add_incident_comment(
    incident_id: str,
    request: Request,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - add comment"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/comments",
            params={"project_id": user["project_id"]},
            json=body
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Request failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/incidents/{incident_id}/activities")
async def get_incident_activities(
    incident_id: str,
    user=Depends(get_current_user_from_token)
):
    """Proxy to incident service - get activities"""
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.INCIDENT_SERVICE_URL}/incidents/{incident_id}/activities",
            params={"project_id": user["project_id"]}
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


# Monitoring Integration endpoints
@router.get("/projects/{project_id}/monitoring/integrations")
async def list_monitoring_integrations(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - list monitoring integrations"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations",
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to list integrations')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/projects/{project_id}/monitoring/integrations")
async def create_monitoring_integration(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - create monitoring integration"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to create integration')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def get_monitoring_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - get monitoring integration"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations/{integration_id}",
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to get integration')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.patch("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def update_monitoring_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - update monitoring integration"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.patch(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations/{integration_id}",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to update integration')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.delete("/projects/{project_id}/monitoring/integrations/{integration_id}")
async def delete_monitoring_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - delete monitoring integration"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.delete(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations/{integration_id}",
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to delete integration')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/projects/{project_id}/monitoring/integrations/test-connection")
async def test_monitoring_connection(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - test monitoring connection"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    body = await request.json()

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations/test-connection",
            json=body,
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Connection test failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.post("/projects/{project_id}/monitoring/integrations/{integration_id}/test")
async def test_existing_monitoring_integration(
    project_id: str,
    integration_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - test existing monitoring integration"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.post(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/integrations/{integration_id}/test",
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Connection test failed')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()


@router.get("/projects/{project_id}/monitoring/alerts")
async def list_monitoring_alerts(
    project_id: str,
    request: Request,
    authorization: Optional[str] = Header(None)
):
    """Proxy to auth service - list monitoring alerts"""
    # Try to get token from Authorization header or cookies
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]

    if not token:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient(timeout=settings.SERVICE_TIMEOUT) as client:
        response = await client.get(
            f"{settings.AUTH_SERVICE_URL}/projects/{project_id}/monitoring/alerts",
            headers={"Authorization": f"Bearer {token}"},
            cookies=request.cookies
        )
        if response.status_code != 200:
            error_message = get_error_message(response, 'Failed to list alerts')
            raise HTTPException(status_code=response.status_code, detail=error_message)
        return response.json()
