"""
CRUD endpoints for cloud connections
"""
import uuid
from asgiref.sync import sync_to_async
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any

from django.utils import timezone

from shared.models import CloudConnection, Project
from app.utils.encryption import encrypt_credentials, decrypt_credentials
from app.providers.azure import test_azure_connection
from app.providers.aws import test_aws_connection
from app.providers.gcp import test_gcp_connection

router = APIRouter()

PROVIDER_TESTERS = {
    "azure": test_azure_connection,
    "aws": test_aws_connection,
    "gcp": test_gcp_connection,
}


class CreateConnectionRequest(BaseModel):
    provider: str  # azure, aws, gcp
    name: str
    credentials: Dict[str, Any]
    config: Optional[Dict[str, Any]] = None


class UpdateConnectionRequest(BaseModel):
    name: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None
    config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class TestConnectionRequest(BaseModel):
    provider: str
    credentials: Dict[str, Any]
    config: Optional[Dict[str, Any]] = None


def _connection_to_response(conn: CloudConnection, include_credentials: bool = False) -> dict:
    """Convert CloudConnection to response dict. Never include credentials by default."""
    data = {
        "id": str(conn.id),
        "project_id": str(conn.project_id),
        "provider": conn.provider,
        "name": conn.name,
        "config": conn.config or {},
        "is_active": conn.is_active,
        "status": conn.status,
        "status_message": conn.status_message or "",
        "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
        "resources_count": conn.resources_count,
        "created_at": conn.created_at.isoformat(),
        "updated_at": conn.updated_at.isoformat(),
    }
    if include_credentials:
        try:
            data["credentials"] = decrypt_credentials(conn.credentials_encrypted)
        except Exception:
            data["credentials"] = {}
    return data


@sync_to_async
def _get_project(project_id: str) -> Project:
    """Get project by ID or raise 404."""
    try:
        return Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")


@sync_to_async
def _create_connection(project, body, encrypted):
    conn = CloudConnection.objects.create(
        project=project,
        tenant=project.tenant,
        provider=body.provider,
        name=body.name,
        credentials_encrypted=encrypted,
        config=body.config or {},
        is_active=True,
        status="pending",
    )
    return _connection_to_response(conn)


@sync_to_async
def _list_connections(project_id):
    conns = CloudConnection.objects.filter(project_id=project_id).order_by("-created_at")
    return {"connections": [_connection_to_response(c) for c in conns]}


@sync_to_async
def _get_connection(connection_id, project_id):
    try:
        conn = CloudConnection.objects.get(id=connection_id, project_id=project_id)
        return _connection_to_response(conn)
    except CloudConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")


@sync_to_async
def _update_connection(connection_id, project_id, body):
    try:
        conn = CloudConnection.objects.get(id=connection_id, project_id=project_id)
    except CloudConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    if body.name is not None:
        conn.name = body.name
    if body.config is not None:
        conn.config = body.config
    if body.is_active is not None:
        conn.is_active = body.is_active
    if body.credentials is not None:
        conn.credentials_encrypted = encrypt_credentials(body.credentials)
    conn.save()
    return _connection_to_response(conn)


@sync_to_async
def _delete_connection(connection_id, project_id):
    try:
        conn = CloudConnection.objects.get(id=connection_id, project_id=project_id)
    except CloudConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.delete()
    return {"status": "deleted", "id": connection_id}


@router.post("", status_code=201)
async def create_connection(
    body: CreateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a cloud connection. Credentials are encrypted before storage."""
    if body.provider not in ("azure", "aws", "gcp"):
        raise HTTPException(status_code=400, detail="provider must be azure, aws, or gcp")
    project = await _get_project(project_id)
    encrypted = encrypt_credentials(body.credentials)
    return await _create_connection(project, body, encrypted)


@router.get("")
async def list_connections(
    project_id: str = Query(..., description="Project ID"),
):
    """List connections for a project. Never returns credentials."""
    await _get_project(project_id)
    return await _list_connections(project_id)


@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a single connection. Never returns credentials."""
    await _get_project(project_id)
    return await _get_connection(connection_id, project_id)


@router.patch("/{connection_id}")
async def update_connection(
    connection_id: str,
    body: UpdateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a connection."""
    await _get_project(project_id)
    return await _update_connection(connection_id, project_id, body)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a connection."""
    await _get_project(project_id)
    return await _delete_connection(connection_id, project_id)


@router.post("/test")
async def test_connection(
    body: TestConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Test connection without saving. Validates credentials against cloud provider."""
    await _get_project(project_id)
    if body.provider not in PROVIDER_TESTERS:
        raise HTTPException(status_code=400, detail="provider must be azure, aws, or gcp")
    tester = PROVIDER_TESTERS[body.provider]
    try:
        result = await tester(body.credentials)
        return result
    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "error": type(e).__name__,
        }
