"""
APM metrics endpoints
"""
import logging
from datetime import datetime
from typing import Any, Optional

from asgiref.sync import sync_to_async
from django.utils import timezone
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from shared.models.observability import (
    MetricDataPoint,
    Transaction,
    ServiceRegistration,
)
from shared.utils.responses import (
    success_response,
    validate_project_id,
    validate_required_fields,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class MetricDataPointSchema(BaseModel):
    """Single metric data point"""
    service_name: str
    metric_name: str
    value: float
    metric_type: str = "gauge"  # gauge, counter, histogram
    tags: dict = {}
    timestamp: Optional[str] = None


class IngestRequest(BaseModel):
    """Batch metric ingest request - project_id and tenant_id injected by API gateway"""
    metrics: list[MetricDataPointSchema]
    project_id: Optional[str] = None
    tenant_id: Optional[str] = None


class TransactionRecord(BaseModel):
    """Transaction record for APM"""
    transaction_id: str
    service_name: str
    endpoint: str
    method: str = "GET"
    status_code: int = 200
    duration_ms: float
    db_duration_ms: float = 0
    external_duration_ms: float = 0
    timestamp: str
    error: Optional[str] = None


def _percentile(values: list[float], p: float) -> float:
    """Calculate percentile of sorted values."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * p / 100
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_vals) else f
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f]) if c != f else sorted_vals[f]


async def _upsert_service_registration(project_id: str, tenant_id: str, service_name: str):
    """Auto-update ServiceRegistration when new data is ingested."""
    @sync_to_async
    def _do():
        from django.utils import timezone
        reg, _ = ServiceRegistration.objects.update_or_create(
            project_id=project_id,
            tenant_id=tenant_id,
            service_name=service_name,
            defaults={
                "last_seen": timezone.now(),
                "source": "sdk",
                "service_type": "backend",
            },
        )
        return reg

    await _do()


@router.post("/ingest")
async def ingest_metrics(request: Request) -> dict[str, Any]:
    """Accept batch of metric data points. project_id and tenant_id from body (injected by gateway)."""
    body = await request.json()
    project_id = body.get("project_id")
    tenant_id = body.get("tenant_id")
    if not project_id or not tenant_id:
        raise HTTPException(status_code=400, detail="project_id and tenant_id are required (injected by API gateway)")

    metrics_data = body.get("metrics", [])
    now = timezone.now()

    @sync_to_async
    def _create_metrics():
        count = 0
        for m in metrics_data:
            ts_str = m.get("timestamp")
            ts = now
            if ts_str:
                try:
                    ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except (ValueError, TypeError):
                    pass
            MetricDataPoint.objects.create(
                project_id=project_id,
                tenant_id=tenant_id,
                service_name=m.get("service_name", ""),
                metric_name=m.get("metric_name", ""),
                value=float(m.get("value", 0)),
                metric_type=m.get("metric_type", "gauge"),
                tags=m.get("tags", {}),
                timestamp=ts,
            )
            count += 1
        return count

    count = await _create_metrics()
    for m in metrics_data:
        svc = m.get("service_name")
        if svc:
            await _upsert_service_registration(project_id, tenant_id, svc)

    logger.info("Ingested %d metrics", count)
    return {"ingested": count}


@router.get("/services")
async def list_services(
    request: Request,
    project_id: Optional[str] = Query(None),
):
    """List all services that have reported metrics."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _list():
        from django.db.models import Count
        from shared.models.observability import Transaction
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
        # Fallback to ServiceRegistration if no data yet
        if not services:
            services = set(
                ServiceRegistration.objects.filter(project_id=pid)
                .values_list("service_name", flat=True)
            )
        return sorted(services)

    return await _list()


@router.get("/services-overview")
async def list_services_overview(
    request: Request,
    project_id: Optional[str] = Query(None),
):
    """List all services with overview metrics for APM dashboard."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _overview():
        services = list(
            Transaction.objects.filter(project_id=pid)
            .values_list("service_name", flat=True)
            .distinct()
        )
        result = []
        for name in sorted(set(services)):
            txns = list(
                Transaction.objects.filter(project_id=pid, service_name=name)
                .values("duration_ms", "status_code", "timestamp")
                .order_by("-timestamp")[:500]
            )
            total = len(txns)
            if not total:
                continue
            durations = [t["duration_ms"] for t in txns]
            errors = sum(1 for t in txns if t.get("status_code", 200) >= 400)
            sparkline = []
            for i in range(7):
                bucket = txns[i * total // 7 : (i + 1) * total // 7] if total > 7 else txns
                if bucket:
                    sparkline.append(round(sum(d["duration_ms"] for d in bucket) / len(bucket), 1))
                else:
                    sparkline.append(0)
            result.append({
                "name": name,
                "throughput": round(total * 2.5, 1),
                "avgResponseTime": round(sum(durations) / total, 2) if total else 0,
                "errorRate": round(errors / total * 100, 2) if total else 0,
                "sparkline": sparkline,
            })
        return result

    return await _overview()


@router.get("/services/{service_name}/overview")
async def get_service_overview(
    service_name: str,
    request: Request,
    project_id: Optional[str] = Query(None),
):
    """Service overview: throughput, avg response time, error rate, apdex."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        txns = list(
            Transaction.objects.filter(project_id=pid, service_name=service_name)
            .values("duration_ms", "status_code")
        )
        return txns

    txns = await _get()
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    total = len(txns)
    durations = [t["duration_ms"] for t in txns]
    errors = sum(1 for t in txns if t.get("status_code", 200) >= 400)
    satisfied = sum(1 for d in durations if d < 500)
    tolerated = sum(1 for d in durations if 500 <= d < 1500)
    apdex = (satisfied + tolerated / 2) / total if total else 0

    return {
        "service_name": service_name,
        "throughput_rpm": round(total * 2.5, 1),
        "avg_response_time_ms": round(sum(durations) / total, 2),
        "error_rate_percent": round(errors / total * 100, 2),
        "apdex": round(apdex, 3),
        "total_transactions": total,
    }


@router.get("/services/{service_name}/transactions")
async def get_transactions(
    service_name: str,
    request: Request,
    project_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
):
    """Transaction list with p50/p95/p99 latencies."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        txns = list(
            Transaction.objects.filter(project_id=pid, service_name=service_name)
            .values(
                "transaction_id", "service_name", "endpoint", "method",
                "status_code", "duration_ms", "db_duration_ms", "external_duration_ms",
                "error", "timestamp"
            )
            .order_by("-timestamp")[:limit]
        )
        for t in txns:
            if isinstance(t.get("timestamp"), datetime):
                t["timestamp"] = t["timestamp"].isoformat() + "Z" if t["timestamp"].tzinfo else t["timestamp"].isoformat() + "Z"
        return txns

    txns = await _get()
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    @sync_to_async
    def _get_all_durations():
        return list(
            Transaction.objects.filter(project_id=pid, service_name=service_name)
            .values_list("duration_ms", flat=True)
        )

    all_durations = await _get_all_durations()
    durations = sorted(all_durations)

    return {
        "service_name": service_name,
        "transactions": txns,
        "p50_ms": round(_percentile(durations, 50), 2),
        "p95_ms": round(_percentile(durations, 95), 2),
        "p99_ms": round(_percentile(durations, 99), 2),
        "total_count": len(all_durations),
    }


@router.get("/services/{service_name}/slow-transactions")
async def get_slow_transactions(
    service_name: str,
    request: Request,
    project_id: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    min_duration_ms: float = Query(200, ge=0),
):
    """Slowest transactions for a service."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        return list(
            Transaction.objects.filter(
                project_id=pid,
                service_name=service_name,
                duration_ms__gte=min_duration_ms,
            )
            .values(
                "transaction_id", "service_name", "endpoint", "method",
                "status_code", "duration_ms", "db_duration_ms", "external_duration_ms",
                "error", "timestamp"
            )
            .order_by("-duration_ms")[:limit]
        )

    txns = await _get()
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    for t in txns:
        if isinstance(t.get("timestamp"), datetime):
            t["timestamp"] = t["timestamp"].isoformat() + "Z" if t["timestamp"].tzinfo else t["timestamp"].isoformat() + "Z"
    return txns


@router.get("/services/{service_name}/database-queries")
async def get_database_queries(
    service_name: str,
    request: Request,
    project_id: Optional[str] = Query(None),
):
    """Database query metrics for a service."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        with_db = list(
            Transaction.objects.filter(
                project_id=pid,
                service_name=service_name,
                db_duration_ms__gt=0,
            )
            .values_list("db_duration_ms", flat=True)
        )
        return with_db

    durations = await _get()

    @sync_to_async
    def _service_exists():
        return Transaction.objects.filter(project_id=pid, service_name=service_name).exists()

    if not await _service_exists():
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    return {
        "service_name": service_name,
        "query_count": len(durations),
        "avg_query_time_ms": round(sum(durations) / len(durations), 2) if durations else 0,
        "total_db_time_ms": round(sum(durations), 2),
        "p95_db_time_ms": round(_percentile(durations, 95), 2) if durations else 0,
    }


@router.get("/services/{service_name}/external-services")
async def get_external_services(
    service_name: str,
    request: Request,
    project_id: Optional[str] = Query(None),
):
    """External service call metrics for a service."""
    pid = project_id or request.headers.get("X-Project-ID")
    validate_project_id(pid, source="query")

    @sync_to_async
    def _get():
        return list(
            Transaction.objects.filter(
                project_id=pid,
                service_name=service_name,
                external_duration_ms__gt=0,
            )
            .values_list("external_duration_ms", flat=True)
        )

    durations = await _get()

    @sync_to_async
    def _service_exists():
        return Transaction.objects.filter(project_id=pid, service_name=service_name).exists()

    if not await _service_exists():
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    return {
        "service_name": service_name,
        "call_count": len(durations),
        "avg_external_time_ms": round(sum(durations) / len(durations), 2) if durations else 0,
        "total_external_time_ms": round(sum(durations), 2),
        "p95_external_time_ms": round(_percentile(durations, 95), 2) if durations else 0,
    }
