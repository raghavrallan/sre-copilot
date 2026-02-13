"""
APM metrics endpoints
"""
import logging
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.storage import metrics_data_points, transactions
from app.services.demo_data import generate_demo_transactions, SERVICES

logger = logging.getLogger(__name__)

router = APIRouter()


class MetricDataPoint(BaseModel):
    """Single metric data point"""
    service_name: str
    metric_name: str
    value: float
    metric_type: str = "gauge"  # gauge, counter, histogram
    tags: dict = {}
    timestamp: Optional[str] = None


class IngestRequest(BaseModel):
    """Batch metric ingest request"""
    metrics: list[MetricDataPoint]


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


def _ensure_transactions() -> None:
    """Ensure we have demo transactions if storage is empty."""
    if not transactions:
        transactions.extend(generate_demo_transactions())
        logger.info("Generated demo transactions for empty storage")


def _get_service_transactions(service_name: str) -> list[dict[str, Any]]:
    """Get transactions for a service."""
    _ensure_transactions()
    return [t for t in transactions if t["service_name"] == service_name]


def _percentile(values: list[float], p: float) -> float:
    """Calculate percentile of sorted values."""
    if not values:
        return 0.0
    sorted_vals = sorted(values)
    k = (len(sorted_vals) - 1) * p / 100
    f = int(k)
    c = f + 1 if f + 1 < len(sorted_vals) else f
    return sorted_vals[f] + (k - f) * (sorted_vals[c] - sorted_vals[f]) if c != f else sorted_vals[f]


@router.post("/ingest")
async def ingest_metrics(request: IngestRequest) -> dict[str, Any]:
    """Accept batch of metric data points."""
    from datetime import datetime
    count = 0
    for m in request.metrics:
        point = {
            "service_name": m.service_name,
            "metric_name": m.metric_name,
            "value": m.value,
            "metric_type": m.metric_type,
            "tags": m.tags,
            "timestamp": m.timestamp or datetime.utcnow().isoformat() + "Z",
        }
        metrics_data_points.append(point)
        count += 1
    logger.info("Ingested %d metrics", count)
    return {"ingested": count}


@router.get("/services")
async def list_services() -> list[str]:
    """List all services that have reported metrics."""
    _ensure_transactions()
    services_with_metrics = set(m.get("service_name") for m in metrics_data_points)
    services_with_txns = set(t["service_name"] for t in transactions)
    return sorted(services_with_metrics | services_with_txns or set(SERVICES))


@router.get("/services-overview")
async def list_services_overview() -> list[dict[str, Any]]:
    """List all services with overview metrics for APM dashboard."""
    _ensure_transactions()
    service_names = set(t["service_name"] for t in transactions)

    result = []
    for name in sorted(service_names):
        txns = [t for t in transactions if t["service_name"] == name]
        total = len(txns)
        durations = [t["duration_ms"] for t in txns]
        errors = sum(1 for t in txns if t.get("status_code", 200) >= 400)

        # Generate sparkline from recent transactions
        sparkline = []
        for i in range(7):
            bucket = txns[i * total // 7:(i + 1) * total // 7] if total > 7 else txns
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


@router.get("/services/{service_name}/overview")
async def get_service_overview(service_name: str) -> dict[str, Any]:
    """Service overview: throughput, avg response time, error rate, apdex."""
    txns = _get_service_transactions(service_name)
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
        "throughput_rpm": round(total * 2.5, 1),  # Approximate
        "avg_response_time_ms": round(sum(durations) / total, 2),
        "error_rate_percent": round(errors / total * 100, 2),
        "apdex": round(apdex, 3),
        "total_transactions": total,
    }


@router.get("/services/{service_name}/transactions")
async def get_transactions(
    service_name: str,
    limit: int = Query(50, ge=1, le=200),
) -> list[dict[str, Any]]:
    """Transaction list with p50/p95/p99 latencies."""
    txns = _get_service_transactions(service_name)
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    durations = sorted([t["duration_ms"] for t in txns])
    return {
        "service_name": service_name,
        "transactions": txns[:limit],
        "p50_ms": round(_percentile(durations, 50), 2),
        "p95_ms": round(_percentile(durations, 95), 2),
        "p99_ms": round(_percentile(durations, 99), 2),
        "total_count": len(txns),
    }


@router.get("/services/{service_name}/slow-transactions")
async def get_slow_transactions(
    service_name: str,
    limit: int = Query(20, ge=1, le=100),
    min_duration_ms: float = Query(200, ge=0),
) -> list[dict[str, Any]]:
    """Slowest transactions for a service."""
    txns = _get_service_transactions(service_name)
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    slow = [t for t in txns if t["duration_ms"] >= min_duration_ms]
    slow.sort(key=lambda x: x["duration_ms"], reverse=True)
    return slow[:limit]


@router.get("/services/{service_name}/database-queries")
async def get_database_queries(service_name: str) -> dict[str, Any]:
    """Database query metrics for a service."""
    txns = _get_service_transactions(service_name)
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    with_db = [t for t in txns if t.get("db_duration_ms", 0) > 0]
    durations = [t["db_duration_ms"] for t in with_db]

    return {
        "service_name": service_name,
        "query_count": len(with_db),
        "avg_query_time_ms": round(sum(durations) / len(durations), 2) if durations else 0,
        "total_db_time_ms": round(sum(durations), 2),
        "p95_db_time_ms": round(_percentile(durations, 95), 2) if durations else 0,
    }


@router.get("/services/{service_name}/external-services")
async def get_external_services(service_name: str) -> dict[str, Any]:
    """External service call metrics for a service."""
    txns = _get_service_transactions(service_name)
    if not txns:
        raise HTTPException(status_code=404, detail=f"Service {service_name} not found")

    with_external = [t for t in txns if t.get("external_duration_ms", 0) > 0]
    durations = [t["external_duration_ms"] for t in with_external]

    return {
        "service_name": service_name,
        "call_count": len(with_external),
        "avg_external_time_ms": round(sum(durations) / len(durations), 2) if durations else 0,
        "total_external_time_ms": round(sum(durations), 2),
        "p95_external_time_ms": round(_percentile(durations, 95), 2) if durations else 0,
    }
