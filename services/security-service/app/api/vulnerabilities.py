"""
Security vulnerability endpoints - ingest, list, update, overview, dependency tree.
"""
import logging
from typing import Any, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.demo_data import generate_demo_vulnerabilities

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Vulnerabilities"])

# In-memory storage
VULNERABILITIES: dict[str, dict[str, Any]] = {}
DEPENDENCY_TREES: dict[str, dict[str, Any]] = {}  # service_name -> tree


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


def _build_overview() -> OverviewResponse:
    """Build overview from current vulnerabilities."""
    by_sev: dict[str, int] = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_svc: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for v in VULNERABILITIES.values():
        by_sev[v["severity"]] = by_sev.get(v["severity"], 0) + 1
        by_svc[v["service_name"]] = by_svc.get(v["service_name"], 0) + 1
        by_status[v["status"]] = by_status.get(v["status"], 0) + 1
    return OverviewResponse(
        by_severity=by_sev,
        by_service=by_svc,
        by_status=by_status,
        total=len(VULNERABILITIES),
        trends={
            "resolved_count": by_status.get("resolved", 0),
            "open_count": by_status.get("open", 0) + by_status.get("in_progress", 0),
        },
    )


# Endpoints
@router.post("/ingest")
async def ingest_vulnerabilities(req: VulnerabilityIngestRequest) -> dict[str, Any]:
    """Ingest vulnerability scan results."""
    import uuid
    from datetime import datetime

    now = datetime.utcnow().isoformat() + "Z"
    ingested = 0
    for v in req.vulnerabilities:
        vuln_id = str(uuid.uuid4())
        entry = {
            "vuln_id": vuln_id,
            "cve_id": v.cve_id,
            "title": v.title,
            "description": v.description,
            "severity": v.severity,
            "service_name": req.service_name,
            "package_name": v.package_name,
            "installed_version": v.installed_version,
            "fixed_version": v.fixed_version,
            "source": req.source,
            "status": "open",
            "first_detected": now,
            "last_seen": now,
            "assignee": None,
            "notes": None,
        }
        VULNERABILITIES[vuln_id] = entry
        ingested += 1
    logger.info("Ingested %d vulnerabilities for %s from %s", ingested, req.service_name, req.source)
    return {"ingested": ingested, "service_name": req.service_name, "source": req.source}


@router.get("", response_model=list[Vulnerability])
async def list_vulnerabilities(
    service: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None),
) -> list[Vulnerability]:
    """List all vulnerabilities with optional filters."""
    items = list(VULNERABILITIES.values())
    if service:
        items = [v for v in items if v["service_name"] == service]
    if severity:
        items = [v for v in items if v["severity"] == severity]
    if status:
        items = [v for v in items if v["status"] == status]
    if source:
        items = [v for v in items if v["source"] == source]
    return [Vulnerability(**v) for v in items]


@router.get("/overview", response_model=OverviewResponse)
async def get_overview() -> OverviewResponse:
    """Dashboard overview: counts by severity, service, status, trends."""
    return _build_overview()


@router.get("/services/{service_name}/dependencies", response_model=dict[str, Any])
async def get_service_dependencies(service_name: str) -> dict[str, Any]:
    """Get dependency tree for a service."""
    if service_name not in DEPENDENCY_TREES:
        # Build a simple demo tree from vulnerabilities for this service
        deps = {}
        for v in VULNERABILITIES.values():
            if v["service_name"] == service_name:
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
        DEPENDENCY_TREES[service_name] = {"service_name": service_name, "dependencies": list(deps.values())}
    return DEPENDENCY_TREES[service_name]


@router.get("/{vuln_id}", response_model=Vulnerability)
async def get_vulnerability(vuln_id: str) -> Vulnerability:
    """Get vulnerability detail."""
    _validate_uuid(vuln_id)
    if vuln_id not in VULNERABILITIES:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    return Vulnerability(**VULNERABILITIES[vuln_id])


@router.patch("/{vuln_id}", response_model=Vulnerability)
async def update_vulnerability(vuln_id: str, req: VulnerabilityUpdateRequest) -> Vulnerability:
    """Update status, assignee, notes."""
    _validate_uuid(vuln_id)
    if vuln_id not in VULNERABILITIES:
        raise HTTPException(status_code=404, detail="Vulnerability not found")
    v = VULNERABILITIES[vuln_id]
    if req.status is not None:
        v["status"] = req.status
    if req.assignee is not None:
        v["assignee"] = req.assignee
    if req.notes is not None:
        v["notes"] = req.notes
    logger.info("Updated vulnerability %s: status=%s", vuln_id, req.status)
    return Vulnerability(**v)
