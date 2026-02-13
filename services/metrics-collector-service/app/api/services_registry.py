"""
Services registry endpoint - returns list of registered services for a project.
Used by onboarding wizard to verify agent/SDK connection.
"""
from typing import Any, Optional

from asgiref.sync import sync_to_async
from fastapi import APIRouter, HTTPException, Query, Request

from shared.models.observability import (
    MetricDataPoint,
    Transaction,
    ServiceRegistration,
)

router = APIRouter()


@router.get("/registry")
async def get_services_registry(
    request: Request,
    project_id: Optional[str] = Query(None, alias="project_id"),
) -> list[dict[str, Any]]:
    """Return list of services registered for the project (from metrics, traces, or ServiceRegistration)."""
    pid = project_id or request.headers.get("X-Project-ID")
    if not pid:
        raise HTTPException(
            status_code=400,
            detail="project_id query param or X-Project-ID header required",
        )

    @sync_to_async
    def _list():
        services = set(
            MetricDataPoint.objects.filter(project_id=pid)
            .values_list("service_name", flat=True)
            .distinct()
        )
        services |= set(
            Transaction.objects.filter(project_id=pid)
            .values_list("service_name", flat=True)
            .distinct()
        )
        if not services:
            services = set(
                ServiceRegistration.objects.filter(project_id=pid).values_list(
                    "service_name", flat=True
                )
            )
        regs = list(
            ServiceRegistration.objects.filter(
                project_id=pid, service_name__in=services
            ).values("service_name", "source", "last_seen", "service_type")
        )
        reg_map = {r["service_name"]: r for r in regs}
        result = []
        for name in sorted(services):
            r = reg_map.get(name, {})
            result.append({
                "service_name": name,
                "source": r.get("source", "sdk"),
                "last_seen": r.get("last_seen"),
                "service_type": r.get("service_type", "backend"),
            })
        return result

    return await _list()
