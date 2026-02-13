"""
Webhook endpoints for CI/CD events - creates Deployment records.
Webhooks use webhook_secret for validation, NOT JWT.
"""
import hashlib
import hmac
import json
import logging
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Request, HTTPException, Header
from django.utils import timezone

from shared.models import CICDConnection, Project
from shared.models.observability import Deployment

logger = logging.getLogger(__name__)

router = APIRouter()


def _verify_github_signature(payload: bytes, signature: Optional[str], secret: str) -> bool:
    """Verify GitHub X-Hub-Signature-256. signature is 'sha256=...'"""
    if not secret or not signature:
        return False
    if not signature.startswith("sha256="):
        return False
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def _verify_webhook_secret(request: Request, secret: str) -> bool:
    """Generic header-based secret: X-Webhook-Secret"""
    provided = request.headers.get("X-Webhook-Secret")
    return bool(secret and provided and hmac.compare_digest(secret, provided))


def _create_deployment(
    project_id: str,
    tenant_id: str,
    service: str,
    version: str,
    commit_sha: str = "",
    description: str = "",
    deployed_by: str = "",
    source: str = "webhook",
    status: str = "success",
) -> dict:
    """Create a Deployment record in the database."""
    dep_id = str(uuid.uuid4())
    now = timezone.now()
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
        completed_at=now,
        source=source,
    )
    return {
        "deployment_id": dep_id,
        "service": service,
        "version": version,
        "commit_sha": commit_sha,
        "status": status,
    }


# ---- GitHub webhook ----
@router.post("/{connection_id}/github")
async def github_webhook(
    connection_id: str,
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
):
    """
    Receive GitHub webhook events: deployment, workflow_run, push.
    Validates X-Hub-Signature-256 against connection's webhook_secret.
    """
    try:
        conn = CICDConnection.objects.get(id=connection_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    if not conn.is_active:
        raise HTTPException(status_code=400, detail="Connection is inactive")

    payload = await request.body()
    if not _verify_github_signature(payload, x_hub_signature_256, conn.webhook_secret or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    try:
        data = json.loads(payload)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event = request.headers.get("X-GitHub-Event", "")
    project_id = str(conn.project_id)
    tenant_id = str(conn.tenant_id)

    deployment_created = None

    if event == "deployment":
        dep = data.get("deployment", {})
        repo = data.get("repository", {})
        repo_name = repo.get("full_name", repo.get("name", "unknown"))
        deployment_created = _create_deployment(
            project_id=project_id,
            tenant_id=tenant_id,
            service=repo_name,
            version=dep.get("ref", dep.get("sha", "")[:7] if dep.get("sha") else "unknown"),
            commit_sha=(dep.get("sha") or "")[:40],
            description=dep.get("description", ""),
            deployed_by=data.get("sender", {}).get("login", "github"),
            source="github",
        )
    elif event == "workflow_run":
        wf = data.get("workflow_run", {})
        repo = data.get("repository", {})
        repo_name = repo.get("full_name", repo.get("name", "unknown"))
        conclusion = wf.get("conclusion", "unknown")
        status = "success" if conclusion == "success" else ("failed" if conclusion == "failure" else "in_progress")
        deployment_created = _create_deployment(
            project_id=project_id,
            tenant_id=tenant_id,
            service=repo_name,
            version=(wf.get("head_sha") or "")[:7] or "unknown",
            commit_sha=(wf.get("head_sha") or "")[:40],
            description=wf.get("name", ""),
            deployed_by=wf.get("actor", {}).get("login", "github"),
            source="github",
            status=status,
        )
    elif event == "push":
        repo = data.get("repository", {})
        repo_name = repo.get("full_name", repo.get("name", "unknown"))
        head = data.get("head_commit") or {}
        sha = (head.get("sha") or data.get("after") or "")[:40]
        deployment_created = _create_deployment(
            project_id=project_id,
            tenant_id=tenant_id,
            service=repo_name,
            version=sha[:7] if sha else "unknown",
            commit_sha=sha,
            description=head.get("message", "")[:500] or "Push",
            deployed_by=data.get("pusher", {}).get("name", "github"),
            source="github",
        )
    else:
        return {"received": True, "event": event, "message": "Event type not tracked for deployments"}

    return {"received": True, "event": event, "deployment": deployment_created}


# ---- Azure DevOps webhook ----
@router.post("/{connection_id}/azure-devops")
async def azure_devops_webhook(
    connection_id: str,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
):
    """
    Receive Azure DevOps service hooks (build completed, release, etc.).
    Validates X-Webhook-Secret against connection's webhook_secret.
    """
    try:
        conn = CICDConnection.objects.get(id=connection_id)
    except CICDConnection.DoesNotExist:
        raise HTTPException(status_code=404, detail="Connection not found")
    if not conn.is_active:
        raise HTTPException(status_code=400, detail="Connection is inactive")

    if not _verify_webhook_secret(request, conn.webhook_secret or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        data = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = data.get("eventType", "")
    project_id = str(conn.project_id)
    tenant_id = str(conn.tenant_id)

    deployment_created = None

    if event_type == "build.complete":
        resource = data.get("resource", {})
        build_id = str(resource.get("id", ""))
        result = resource.get("result", "succeeded")
        status = "success" if result == "succeeded" else ("failed" if result == "failed" else "in_progress")
        definition = resource.get("definition", {})
        build_name = definition.get("name", "build")
        source_version = (resource.get("sourceVersion") or "")[:7]
        deployment_created = _create_deployment(
            project_id=project_id,
            tenant_id=tenant_id,
            service=build_name,
            version=source_version or build_id,
            commit_sha=resource.get("sourceVersion", "")[:40],
            description=f"Build {build_id}",
            deployed_by=resource.get("requestedFor", {}).get("displayName", "azure_devops"),
            source="azure_devops",
            status=status,
        )
    elif event_type == "ms.vss-release.release-completed-event":
        resource = data.get("resource", {})
        release_name = resource.get("name", "release")
        status = "success"
        deployment_created = _create_deployment(
            project_id=project_id,
            tenant_id=tenant_id,
            service=release_name,
            version=release_name,
            commit_sha="",
            description=release_name,
            deployed_by="azure_devops",
            source="azure_devops",
            status=status,
        )
    else:
        return {"received": True, "eventType": event_type, "message": "Event type not tracked for deployments"}

    return {"received": True, "eventType": event_type, "deployment": deployment_created}


# ---- Generic webhook ----
@router.post("/generic/{project_id}")
async def generic_webhook(
    project_id: str,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
):
    """
    Generic webhook for any CI/CD. Expects JSON body:
    { service, version, commit_sha?, description?, deployed_by? }
    Validates X-Webhook-Secret - must match a stored secret for the project
    or use a project-level webhook secret (future: from Project config).
    For now, we accept requests if project exists; in production you'd validate secret.
    """
    try:
        project = Project.objects.get(id=project_id)
    except Project.DoesNotExist:
        raise HTTPException(status_code=404, detail="Project not found")

    # For generic webhook, optional secret - can be configured per-project later
    # For now we accept if project exists; caller can add X-Webhook-Secret for validation
    body = await request.json()
    service = body.get("service") or body.get("service_name")
    version = body.get("version")
    if not service or not version:
        raise HTTPException(status_code=400, detail="service and version are required")

    deployment_created = _create_deployment(
        project_id=str(project.id),
        tenant_id=str(project.tenant_id),
        service=str(service),
        version=str(version),
        commit_sha=(body.get("commit_sha") or "")[:40],
        description=body.get("description", ""),
        deployed_by=body.get("deployed_by", "generic"),
        source="webhook",
    )
    return {"received": True, "deployment": deployment_created}
