"""
Internal endpoints - called by other services (not exposed to users).
These endpoints are authenticated by X-Internal-Service-Key.
"""
from fastapi import APIRouter, HTTPException, Header, Request
from pydantic import BaseModel
from typing import Optional
import os

from shared.models.api_key import ProjectApiKey

router = APIRouter(prefix="/internal", tags=["Internal"])

INTERNAL_SERVICE_KEY = os.getenv("INTERNAL_SERVICE_KEY", "")


def verify_internal(x_internal_service_key: Optional[str] = Header(None)):
    """Verify the internal service key if configured"""
    if INTERNAL_SERVICE_KEY and x_internal_service_key != INTERNAL_SERVICE_KEY:
        raise HTTPException(status_code=403, detail="Invalid internal service key")


class ValidateApiKeyRequest(BaseModel):
    key_hash: str


@router.post("/validate-api-key")
async def validate_api_key(
    request: ValidateApiKeyRequest,
    x_internal_service_key: Optional[str] = Header(None)
):
    """
    Validate an API key hash and return the associated project/tenant.
    Called by the API gateway ingest proxy to authenticate X-API-Key headers.
    """
    verify_internal(x_internal_service_key)

    try:
        api_key = await ProjectApiKey.objects.select_related('project', 'tenant').aget(
            key_hash=request.key_hash
        )
    except ProjectApiKey.DoesNotExist:
        raise HTTPException(status_code=404, detail="API key not found")

    # Check if active
    if not api_key.is_active:
        raise HTTPException(status_code=403, detail="API key is inactive")

    # Check if expired
    if api_key.is_expired:
        raise HTTPException(status_code=403, detail="API key has expired")

    # Check if project is active
    if not api_key.project.is_active:
        raise HTTPException(status_code=403, detail="Project is not active")

    # Update last_used_at (fire and forget)
    try:
        await api_key.aupdate_last_used()
    except Exception:
        pass

    return {
        "valid": True,
        "project_id": str(api_key.project.id),
        "tenant_id": str(api_key.tenant.id),
        "scopes": api_key.scopes,
        "project_name": api_key.project.name,
    }
