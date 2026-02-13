"""
API Key management endpoints for projects.
Users generate API keys here, then use them in their agents/SDKs to send telemetry.
"""
from fastapi import APIRouter, HTTPException, Header, Cookie
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

from shared.models.api_key import ProjectApiKey, hash_api_key
from shared.models.project import Project, ProjectMember
from app.core.security import verify_token

router = APIRouter()

# ---- Helpers ----

async def get_current_user_project(authorization: Optional[str], access_token: Optional[str], project_id: str):
    """Extract user from JWT and verify project access"""
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token and access_token:
        token = access_token
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user_id = payload.get("sub")
    tenant_id = payload.get("tenant_id")

    # Verify user has access to this project
    try:
        membership = await ProjectMember.objects.select_related('project').aget(
            user_id=user_id,
            project_id=project_id
        )
    except ProjectMember.DoesNotExist:
        raise HTTPException(status_code=403, detail="No access to this project")

    # Only admin/owner can manage API keys
    if membership.role not in ('admin', 'owner'):
        raise HTTPException(status_code=403, detail="Only admin or owner can manage API keys")

    return payload, membership


# ---- Request/Response Models ----

ALL_INGEST_SCOPES = [
    "ingest:metrics",
    "ingest:logs",
    "ingest:traces",
    "ingest:errors",
    "ingest:infrastructure",
    "ingest:browser",
    "ingest:vulnerabilities",
]


class CreateApiKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Friendly name for the key")
    scopes: List[str] = Field(default=None, description="Scopes to grant. Null = all ingest scopes")
    expires_in_days: Optional[int] = Field(default=None, ge=1, le=365, description="Days until expiry. Null = never")


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    scopes: list
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime
    expires_at: Optional[datetime] = None


class ApiKeyCreatedResponse(ApiKeyResponse):
    """Response when a key is first created - includes the full key (shown only once)"""
    raw_key: str


class UpdateApiKeyRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    scopes: Optional[List[str]] = None
    is_active: Optional[bool] = None


# ---- Endpoints ----

@router.post("/projects/{project_id}/api-keys", response_model=ApiKeyCreatedResponse, status_code=201)
async def create_api_key(
    project_id: str,
    request: CreateApiKeyRequest,
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Generate a new API key for the project. The full key is returned ONCE."""
    payload, membership = await get_current_user_project(authorization, access_token, project_id)
    tenant_id = payload.get("tenant_id")

    # Validate scopes
    scopes = request.scopes if request.scopes else ALL_INGEST_SCOPES
    invalid_scopes = [s for s in scopes if s not in ALL_INGEST_SCOPES]
    if invalid_scopes:
        raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid_scopes}")

    # Create API key
    api_key_instance, raw_key = ProjectApiKey.create_key(
        project=membership.project,
        tenant_id=tenant_id,
        name=request.name,
        scopes=scopes
    )

    # Set expiry if requested
    if request.expires_in_days:
        from django.utils import timezone
        from datetime import timedelta
        api_key_instance.expires_at = timezone.now() + timedelta(days=request.expires_in_days)

    await api_key_instance.asave()

    return ApiKeyCreatedResponse(
        id=str(api_key_instance.id),
        name=api_key_instance.name,
        key_prefix=api_key_instance.key_prefix,
        scopes=api_key_instance.scopes,
        is_active=api_key_instance.is_active,
        last_used_at=api_key_instance.last_used_at,
        created_at=api_key_instance.created_at,
        expires_at=api_key_instance.expires_at,
        raw_key=raw_key,
    )


@router.get("/projects/{project_id}/api-keys", response_model=List[ApiKeyResponse])
async def list_api_keys(
    project_id: str,
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """List all API keys for a project (never returns full key)."""
    payload, membership = await get_current_user_project(authorization, access_token, project_id)

    keys = []
    async for key in ProjectApiKey.objects.filter(project_id=project_id).order_by('-created_at'):
        keys.append(ApiKeyResponse(
            id=str(key.id),
            name=key.name,
            key_prefix=key.key_prefix,
            scopes=key.scopes,
            is_active=key.is_active,
            last_used_at=key.last_used_at,
            created_at=key.created_at,
            expires_at=key.expires_at,
        ))
    return keys


@router.patch("/projects/{project_id}/api-keys/{key_id}", response_model=ApiKeyResponse)
async def update_api_key(
    project_id: str,
    key_id: str,
    request: UpdateApiKeyRequest,
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Update an API key's name, scopes, or active status."""
    payload, membership = await get_current_user_project(authorization, access_token, project_id)

    try:
        api_key = await ProjectApiKey.objects.aget(id=key_id, project_id=project_id)
    except ProjectApiKey.DoesNotExist:
        raise HTTPException(status_code=404, detail="API key not found")

    if request.name is not None:
        api_key.name = request.name
    if request.scopes is not None:
        invalid_scopes = [s for s in request.scopes if s not in ALL_INGEST_SCOPES]
        if invalid_scopes:
            raise HTTPException(status_code=400, detail=f"Invalid scopes: {invalid_scopes}")
        api_key.scopes = request.scopes
    if request.is_active is not None:
        api_key.is_active = request.is_active

    await api_key.asave()

    return ApiKeyResponse(
        id=str(api_key.id),
        name=api_key.name,
        key_prefix=api_key.key_prefix,
        scopes=api_key.scopes,
        is_active=api_key.is_active,
        last_used_at=api_key.last_used_at,
        created_at=api_key.created_at,
        expires_at=api_key.expires_at,
    )


@router.delete("/projects/{project_id}/api-keys/{key_id}", status_code=204)
async def revoke_api_key(
    project_id: str,
    key_id: str,
    authorization: Optional[str] = Header(None),
    access_token: Optional[str] = Cookie(None)
):
    """Revoke (delete) an API key."""
    payload, membership = await get_current_user_project(authorization, access_token, project_id)

    try:
        api_key = await ProjectApiKey.objects.aget(id=key_id, project_id=project_id)
    except ProjectApiKey.DoesNotExist:
        raise HTTPException(status_code=404, detail="API key not found")

    await api_key.adelete()
    return None
