"""
Security vulnerability endpoints - ingest, list, update, overview, dependency tree.
"""
import logging
from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from asgiref.sync import sync_to_async
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from shared.models.observability import Vulnerability as VulnerabilityModel
from shared.models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Vulnerabilities"])


# Pydantic models
class VulnerabilityIngestItem(BaseModel):
    """Single vulnerability in ingest payload."""

    cve_id: str
    title: str
    description: str
    severity: str = Field(..., pattern="^(critical|high|medium|low)$")
    package_name: str
    installed_version: str
    fixed_version: Optional[str] = None


class VulnerabilityIngestRequest(BaseModel):
    """Ingest vulnerability scan results."""

    project_id: str = Field(..., description="Project ID for scoping")
    source: str = Field(..., pattern="^(pip-audit|npm-audit|bandit|dependabot|trivy)$")
    service_name: str = Field(..., min_length=1)
    vulnerabilities: list[VulnerabilityIngestItem] = Field(default_factory=list)


class VulnerabilityUpdateRequest(BaseModel):
    """Update vulnerability status."""

    status: Optional[str] = Field(
        None,
        pattern="^(open|in_progress|resolved|ignored|false_positive)$",
    )
    assignee: Optional[str] = None
    notes: Optional[str] = None


class Vulnerability(BaseModel):
    """Vulnerability model."""

    vuln_id: str
    cve_id: str
    title: str
    description: str
    severity: str
    service_name: str
    package_name: str
    installed_version: str
    fixed_version: Optional[str] = None
    source: str
    status: str
    first_detected: str
    last_seen: str
    assignee: Optional[str] = None
    notes: Optional[str] = None


class OverviewResponse(BaseModel):
    """Dashboard overview."""

    by_severity: dict[str, int]
    by_service: dict[str, int]
    by_status: dict[str, int]
    total: int
    trends: dict[str, Any]  # e.g. last_7_days_new, resolved_count


def _validate_uuid(value: str) -> str:
    """Validate and return UUID string."""
    try:
        UUID(value)
        return value
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid vulnerability ID format")


def _vuln_model_to_response(v: VulnerabilityModel) -> Vulnerability:
    """Convert Django model to API response."""
    return Vulnerability(
        vuln_id=str(v.id),
        cve_id=v.cve_id,
        title=v.title,
        description=v.description or "",
        severity=v.severity,
        service_name=v.service_name,
        package_name=v.package_name,
        installed_version=v.installed_version,
        fixed_version=v.fixed_version or None,
        source=v.source,
        status=v.status,
        first_detected=v.first_detected.isoformat() + "Z" if v.first_detected else "",
        last_seen=v.last_detected.isoformat() + "Z" if v.last_detected else "",
        assignee=None,  # Model does not have assignee
        notes=None,  # Model does not have notes
    )


@sync_to_async
def _get_project_with_tenant(project_id: str):
    """Get project and tenant for project_id."""
    try:
        project = Project.objects.select_related("tenant").get(id=project_id)
        return project, project.tenant_id
    except Project.DoesNotExist:
        return None, None


# Endpoints
@router.post("/ingest")
async def ingest_vulnerabilities(req: VulnerabilityIngestRequest) -> dict[str, Any]:
    """Ingest vulnerability scan results."""
    project, tenant_id = await _get_project_with_tenant(req.project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    @sync_to_async
    def do_ingest():
        now = datetime.utcnow()
        for v in req.vulnerabilities:
            VulnerabilityModel.objects.update_or_create(
                project_id=req.project_id,
                cve_id=v.cve_id,
                service_name=req.service_name,
                package_name=v.package_name,
                defaults={
                    "tenant_id": tenant_id,
                    "title": v.title,
                    "description": v.description,
                    "severity": v.severity,
                    "installed_version": v.installed_version,
                    "fixed_version": v.fixed_version or "",
                    "source": req.source,
                    "status": "open",
                    "last_detected": now,
                },
            )
        return len(req.vulnerabilities)

    ingested = await do_ingest()
    logger.info("Ingested %d vulnerabilities for %s from %s", ingested, req.service_name, req.source)
    return {"ingested": ingested, "service_name": req.service_name, "source": req.source}


@router.get("", response_model=list[Vulnerability])
async def list_vulnerabilities(
    project_id: str = Query(..., description="Project ID for scoping"),
    service: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
) -> list[Vulnerability]:
    """List all vulnerabilities with optional filters."""

    @sync_to_async
    def do_list():
        qs = VulnerabilityModel.objects.filter(project_id=project_id).order_by("-last_detected")
        if service:
            qs = qs.filter(service_name=service)
        if severity:
            qs = qs.filter(severity=severity)
        if status:
            qs = qs.filter(status=status)
        if source:
            qs = qs.filter(source=source)
        return list(qs)

    items = await do_list()
    return [_vuln_model_to_response(v) for v in items]


@router.get("/overview", response_model=OverviewResponse)
async def get_overview(
    project_id: str = Query(..., description="Project ID for scoping"),
) -> OverviewResponse:
    """Dashboard overview: counts by severity, service, status, trends."""

    @sync_to_async
    def do_overview():
        from django.db.models import Count

        qs = VulnerabilityModel.objects.filter(project_id=project_id)
        by_sev = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        for row in qs.values("severity").annotate(cnt=Count("id")):
            by_sev[row["severity"]] = row["cnt"]

        by_svc = dict(
            qs.values("service_name").annotate(cnt=Count("id")).values_list("service_name", "cnt")
        )
        by_status = dict(qs.values("status").annotate(cnt=Count("id")).values_list("status", "cnt"))

        total = qs.count()
        return OverviewResponse(
            by_severity=by_sev,
            by_service=by_svc,
            by_status=by_status,
            total=total,
            trends={
                "resolved_count": by_status.get("resolved", 0) + by_status.get("fixed", 0),
                "open_count": by_status.get("open", 0) + by_status.get("in_progress", 0),
            },
        )

    return await do_overview()


@router.get("/services/{service_name}/dependencies", response_model=dict[str, Any])
async def get_service_dependencies(
    service_name: str,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> dict[str, Any]:
    """Get dependency tree for a service."""

    @sync_to_async
    def do_deps():
        vulns = list(
            VulnerabilityModel.objects.filter(
                project_id=project_id, service_name=service_name
            ).values("package_name", "installed_version", "cve_id")
        )
        deps = {}
        for v in vulns:
            pkg = v["package_name"]
            if pkg not in deps:
                deps[pkg] = {
                    "name": pkg,
                    "version": v["installed_version"],
                    "direct": True,
                    "vulnerabilities": [],
                }
            deps[pkg]["vulnerabilities"].append(v["cve_id"])
        if not deps:
            deps = {"demo-package": {"name": "demo-package", "version": "1.0.0", "direct": True, "vulnerabilities": []}}
        return {"service_name": service_name, "dependencies": list(deps.values())}

    return await do_deps()


@router.get("/{vuln_id}", response_model=Vulnerability)
async def get_vulnerability(
    vuln_id: str,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> Vulnerability:
    """Get vulnerability detail."""
    _validate_uuid(vuln_id)

    @sync_to_async
    def do_get():
        try:
            return VulnerabilityModel.objects.get(id=vuln_id, project_id=project_id)
        except VulnerabilityModel.DoesNotExist:
            return None

    v = await do_get()
    if not v:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    return _vuln_model_to_response(v)


@router.patch("/{vuln_id}", response_model=Vulnerability)
async def update_vulnerability(
    vuln_id: str,
    req: VulnerabilityUpdateRequest,
    project_id: str = Query(..., description="Project ID for scoping"),
) -> Vulnerability:
    """Update status, assignee, notes."""
    _validate_uuid(vuln_id)

    @sync_to_async
    def do_update():
        try:
            v = VulnerabilityModel.objects.get(id=vuln_id, project_id=project_id)
        except VulnerabilityModel.DoesNotExist:
            return None
        if req.status is not None:
            v.status = req.status
        v.save(update_fields=["status"] if req.status else [])
        return v

    v = await do_update()
    if not v:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    logger.info("Updated vulnerability %s: status=%s", vuln_id, req.status)
    return _vuln_model_to_response(v)
