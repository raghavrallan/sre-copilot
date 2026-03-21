"""
CRUD endpoints for CI/CD connections
"""
import os
import secrets
import logging

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from asgiref.sync import sync_to_async

from shared.models import CICDConnection, Project
from app.utils.encryption import encrypt_credentials, decrypt_credentials
from app.providers.github_provider import test_github_connection
from app.providers.azure_devops_provider import test_azdo_connection
from app.providers.gitlab_provider import test_gitlab_connection
from app.providers.jenkins_provider import test_jenkins_connection

logger = logging.getLogger(__name__)

router = APIRouter()

PROVIDER_TESTERS = {
    "github": test_github_connection,
    "azure_devops": test_azdo_connection,
    "gitlab": test_gitlab_connection,
    "jenkins": test_jenkins_connection,
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
    cfg = conn.config or {}
    data = {
        "id": str(conn.id),
        "project_id": str(conn.project_id),
        "provider": conn.provider,
        "name": conn.name,
        "config": cfg,
        "is_active": conn.is_active,
        "status": conn.status,
        "status_message": conn.status_message or "",
        "webhook_url": conn.webhook_url or "",
        "repos_count": cfg.get("_repos_count", 0),
        "pipelines_count": cfg.get("_pipelines_count", 0),
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


@sync_to_async
def _get_project(project_id: str) -> Project:
    """Get project by ID or raise 404. Eagerly loads tenant to avoid lazy-load in async context."""
    try:
        return Project.objects.select_related("tenant").get(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")


def _build_webhook_url(connection_id: str, provider: str) -> str:
    base = os.getenv("PUBLIC_API_URL", "").rstrip("/")
    if not base:
        base = os.getenv("API_GATEWAY_URL", "http://localhost:8580").rstrip("/")
    provider_path = {
        "github": "github",
        "azure_devops": "azure-devops",
    }.get(provider)
    if provider_path:
        return f"{base}/api/v1/cicd/webhooks/{connection_id}/{provider_path}"
    return ""


@sync_to_async
def _create_connection(project, tenant, provider, name, encrypted, config) -> CICDConnection:
    webhook_secret = secrets.token_hex(32)
    conn = CICDConnection.objects.create(
        project=project,
        tenant=tenant,
        provider=provider,
        name=name,
        credentials_encrypted=encrypted,
        config=config,
        is_active=True,
        status="pending",
        webhook_secret=webhook_secret,
    )
    webhook_url = _build_webhook_url(str(conn.id), provider)
    if webhook_url:
        conn.webhook_url = webhook_url
        conn.save(update_fields=["webhook_url"])
    return conn


@sync_to_async
def _list_connections(project_id: str) -> List[dict]:
    conns = CICDConnection.objects.filter(project_id=project_id).order_by("-created_at")
    return [_connection_to_response(c) for c in conns]


@sync_to_async
def _get_connection(connection_id: str, project_id: str) -> CICDConnection:
    try:
        return CICDConnection.objects.get(id=connection_id, project_id=project_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")


@sync_to_async
def _save_connection(conn):
    conn.save()


@sync_to_async
def _delete_connection(conn):
    conn.delete()


async def _validate_and_update_status(conn: CICDConnection, credentials: Dict[str, Any]):
    """Try to validate credentials and update connection status accordingly."""
    tester = PROVIDER_TESTERS.get(conn.provider)
    if not tester:
        return
    try:
        result = await tester(credentials)
        if result.get("success"):
            conn.status = "connected"
            conn.status_message = ""
        else:
            conn.status = "error"
            conn.status_message = result.get("message", "Validation failed")
    except Exception as e:
        conn.status = "error"
        conn.status_message = str(e)
    await _save_connection(conn)


@router.post("", status_code=201)
async def create_connection(
    body: CreateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Create a CI/CD connection. Credentials are encrypted before storage."""
    valid_providers = ("github", "azure_devops", "gitlab", "jenkins", "bitbucket")
    if body.provider not in valid_providers:
        raise HTTPException(status_code=400, detail=f"provider must be one of {valid_providers}")
    project = await _get_project(project_id)
    encrypted = encrypt_credentials(body.credentials)
    conn = await _create_connection(
        project=project,
        tenant=project.tenant,
        provider=body.provider,
        name=body.name,
        encrypted=encrypted,
        config=body.config or {},
    )
    await _validate_and_update_status(conn, body.credentials)
    return _connection_to_response(conn)


@router.get("")
async def list_connections(
    project_id: str = Query(..., description="Project ID"),
):
    """List connections for a project. Never returns credentials."""
    await _get_project(project_id)
    return {"connections": await _list_connections(project_id)}


@router.get("/{connection_id}")
async def get_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Get a single connection. Never returns credentials."""
    await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
    return _connection_to_response(conn)


@router.patch("/{connection_id}")
async def update_connection(
    connection_id: str,
    body: UpdateConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Update a connection."""
    await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
    if body.name is not None:
        conn.name = body.name
    if body.config is not None:
        conn.config = body.config
    if body.is_active is not None:
        conn.is_active = body.is_active
    if body.credentials is not None:
        conn.credentials_encrypted = encrypt_credentials(body.credentials)
    await _save_connection(conn)
    if body.credentials is not None:
        await _validate_and_update_status(conn, body.credentials)
    return _connection_to_response(conn)


@router.delete("/{connection_id}")
async def delete_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Delete a connection."""
    await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
    await _delete_connection(conn)
    return {"status": "deleted", "id": connection_id}


@router.post("/test")
async def test_connection(
    body: TestConnectionRequest,
    project_id: str = Query(..., description="Project ID"),
):
    """Test connection without saving. Validates credentials against CI/CD provider."""
    await _get_project(project_id)
    if body.provider not in PROVIDER_TESTERS:
        return {
            "success": False,
            "message": f"Test not yet implemented for provider '{body.provider}'. Supported: {list(PROVIDER_TESTERS.keys())}",
        }
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
    await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
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
    await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
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


@sync_to_async
def _import_deployment(project_id, tenant_id, service, version, commit_sha, description, deployed_by, source, status):
    """Create a Deployment record if it doesn't already exist (deduplicate by commit_sha+service)."""
    from shared.models.observability import Deployment
    import uuid
    if commit_sha:
        existing = Deployment.objects.filter(project_id=project_id, commit_sha=commit_sha, service=service).first()
        if existing:
            return None
    from django.utils import timezone
    dep_id = str(uuid.uuid4())
    Deployment.objects.create(
        project_id=project_id,
        tenant_id=tenant_id,
        deployment_id=dep_id,
        service=service,
        version=version,
        environment="production",
        commit_sha=commit_sha,
        description=description,
        deployed_by=deployed_by,
        status=status,
        completed_at=timezone.now(),
        source=source,
    )
    return dep_id


@router.post("/{connection_id}/sync")
async def sync_connection(
    connection_id: str,
    project_id: str = Query(..., description="Project ID"),
):
    """Sync a connection: validate credentials, fetch repos/pipelines, import recent runs as deployments."""
    project = await _get_project(project_id)
    conn = await _get_connection(connection_id, project_id)
    creds = decrypt_credentials(conn.credentials_encrypted)
    config = conn.config or {}

    repos_count = 0
    pipelines_count = 0
    deployments_imported = 0
    sync_error = None

    try:
        tester = PROVIDER_TESTERS.get(conn.provider)
        if tester:
            result = await tester(creds)
            if not result.get("success"):
                conn.status = "error"
                conn.status_message = result.get("message", "Validation failed")
                await _save_connection(conn)
                return _connection_to_response(conn)

        if conn.provider == "github":
            from app.providers.github_provider import list_repos, list_user_repos, list_workflow_runs
            org_val = config.get("organization") or config.get("org")
            repos = []
            if org_val:
                result = await list_repos(creds, org_val)
                repos = result.get("repos", [])
            else:
                result = await list_user_repos(creds, limit=10)
                repos = result.get("repos", [])
            repos_count = len(repos)

            for repo in repos[:5]:
                repo_full = repo.get("full_name")
                if not repo_full:
                    continue
                runs_result = await list_workflow_runs(creds, repo_full, limit=10)
                for run in runs_result.get("runs", []):
                    conclusion = run.get("conclusion", "")
                    status = "success" if conclusion == "success" else ("failed" if conclusion == "failure" else "in_progress")
                    dep_id = await _import_deployment(
                        project_id=project_id,
                        tenant_id=str(project.tenant_id),
                        service=repo_full,
                        version=(run.get("head_sha") or "")[:7] or "unknown",
                        commit_sha=(run.get("head_sha") or "").replace("...", "")[:40],
                        description=run.get("name", ""),
                        deployed_by="github",
                        source="github",
                        status=status,
                    )
                    if dep_id:
                        deployments_imported += 1

        elif conn.provider == "azure_devops":
            from app.providers.azure_devops_provider import list_pipelines as azdo_list
            org_val = config.get("org")
            project_val = config.get("project")
            if org_val and project_val:
                result = await azdo_list(creds, org_val, project_val)
                pipelines_count = len(result.get("pipelines", []))

        elif conn.provider == "gitlab":
            from app.providers.gitlab_provider import list_gitlab_projects
            creds_with_url = {**creds, "url": config.get("gitlab_url", "")}
            result = await list_gitlab_projects(creds_with_url)
            repos_count = len(result.get("repos", []))

        elif conn.provider == "jenkins":
            from app.providers.jenkins_provider import list_jenkins_jobs
            creds_with_url = {**creds, "url": config.get("jenkins_url", ""), "username": config.get("username", "")}
            result = await list_jenkins_jobs(creds_with_url)
            pipelines_count = len(result.get("pipelines", []))

    except Exception as e:
        sync_error = str(e)
        logger.warning("Sync error for connection %s: %s", connection_id, e)

    from django.utils import timezone
    config["_repos_count"] = repos_count
    config["_pipelines_count"] = pipelines_count
    conn.config = config
    conn.status = "connected" if not sync_error else "error"
    conn.status_message = sync_error or ""
    conn.last_sync_at = timezone.now()
    await _save_connection(conn)

    resp = _connection_to_response(conn)
    resp["deployments_imported"] = deployments_imported
    return resp
