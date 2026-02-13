"""
CRUD endpoints for CI/CD connections
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any

from shared.models import CICDConnection, Project
from app.utils.encryption import encrypt_credentials, decrypt_credentials
from app.providers.github_provider import test_github_connection
from app.providers.azure_devops_provider import test_azdo_connection

router = APIRouter()

PROVIDER_TESTERS = {
    "github": test_github_connection,
    "azure_devops": test_azdo_connection,
}


class CreateConnectionRequest(BaseModel):
    provider: str  # github, azure_devops, gitlab, jenkins, bitbucket
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


def _connection_to_response(conn: CICDConnection, include_credentials: bool = False) -> dict:
    """Convert CICDConnection to response dict. Never include credentials by default."""
    data = {
        "id": str(conn.id),
        "project_id": str(conn.project_id),
        "provider": conn.provider,
        "name": conn.name,
        "config": conn.config or {},
        "is_active": conn.is_active,
        "status": conn.status,
        "status_message": conn.status_message or "",
        "webhook_url": conn.webhook_url or "",
        "last_sync_at": conn.last_sync_at.isoformat() if conn.last_sync_at else None,
        "created_at": conn.created_at.isoformat(),
        "updated_at": conn.updated_at.isoformat(),
    }
    if include_credentials:
        try:
            data["credentials"] = decrypt_credentials(conn.credentials_encrypted)
        except Exception:
            data["credentials"] = {}
    return data


def _get_project(project_id: str) -> Project:
    """Get project by ID or raise 404."""
    try:
        return Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")


@router.post("", status_code=201)
async def create_connection(
    body: CreateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a CI/CD connection. Credentials are encrypted before storage."""
    valid_providers = ("github", "azure_devops", "gitlab", "jenkins", "bitbucket")
    if body.provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"provider must be one of {valid_providers}")
    project = _get_project(project_id)
    encrypted = encrypt_credentials(body.credentials)
    conn = CICDConnection.objects.create(
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


@router.get("")
async def list_connections(
    project_id: str = Query(..., description="Project ID"),
):
    """List connections for a project. Never returns credentials."""
    _get_project(project_id)
    conns = CICDConnection.objects.filter(project_id=project_id).order_by("-created_at")
    return {"connections": [_connection_to_response(c) for c in conns]}


@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a single connection. Never returns credentials."""
    _get_project(project_id)
    try:
        conn = CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    return _connection_to_response(conn)


@router.patch("/{connection_id}")
async def update_connection(
    connection_id: str,
    body: UpdateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a connection."""
    _get_project(project_id)
    try:
        conn = CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
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


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a connection."""
    _get_project(project_id)
    try:
        conn = CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    conn.delete()
    return {"status": "deleted", "id": connection_id}


@router.post("/test")
async def test_connection(
    body: TestConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Test connection without saving. Validates credentials against CI/CD provider."""
    _get_project(project_id)
    if body.provider not in PROVIDER_TESTERS:
        raise HTTPException(
            status_code=400,
            detail=f"provider must be one of {list(PROVIDER_TESTERS.keys())}",
        )
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


@router.get("/{connection_id}/pipelines")
async def list_pipelines(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
    org: Optional[str] = Query(None, description="Organization (GitHub org / Azure DevOps org)"),
):
    """List pipelines/repos for a connection. For GitHub: org required. For Azure DevOps: org and project in config."""
    _get_project(project_id)
    try:
        conn = CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    creds = decrypt_credentials(conn.credentials_encrypted)
    config = conn.config or {}
    org_val = org or config.get("org")
    project_val = config.get("project")

    if conn.provider == "github":
        from app.providers.github_provider import list_repos
        if not org_val:
            raise HTTPException(status_code=400, detail="org query param or config.org required for GitHub")
        result = await list_repos(creds, org_val)
        return result
    elif conn.provider == "azure_devops":
        from app.providers.azure_devops_provider import list_pipelines
        if not org_val or not project_val:
            raise HTTPException(status_code=400, detail="org and project (in config) required for Azure DevOps")
        result = await list_pipelines(creds, org_val, project_val)
        return result
    else:
        raise HTTPException(status_code=400, detail=f"pipelines not supported for provider {conn.provider}")


@router.get("/{connection_id}/runs")
async def list_runs(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
    repo: Optional[str] = Query(None, description="Repo (owner/repo for GitHub)"),
    pipeline_id: Optional[str] = Query(None, description="Pipeline ID (Azure DevOps)"),
    limit: int = Query(20, ge=1, le=100),
):
    """List workflow/pipeline runs for a connection."""
    _get_project(project_id)
    try:
        conn = CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    creds = decrypt_credentials(conn.credentials_encrypted)
    config = conn.config or {}
    org_val = config.get("org")
    project_val = config.get("project")

    if conn.provider == "github":
        from app.providers.github_provider import list_workflow_runs
        repo_val = repo or config.get("repo")
        if not repo_val:
            raise HTTPException(status_code=400, detail="repo query param or config.repo required for GitHub")
        result = await list_workflow_runs(creds, repo_val, limit=limit)
        return result
    elif conn.provider == "azure_devops":
        from app.providers.azure_devops_provider import list_pipeline_runs
        if not org_val or not project_val:
            raise HTTPException(status_code=400, detail="org and project (in config) required for Azure DevOps")
        pipeline_id_val = pipeline_id or config.get("pipeline_id")
        if not pipeline_id_val:
            raise HTTPException(status_code=400, detail="pipeline_id query param or config.pipeline_id required")
        result = await list_pipeline_runs(creds, org_val, project_val, pipeline_id_val, limit=limit)
        return result
    else:
        raise HTTPException(status_code=400, detail=f"runs not supported for provider {conn.provider}")
