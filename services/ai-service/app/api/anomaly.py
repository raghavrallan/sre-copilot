"""
Anomaly Detection endpoints - Z-score based time-series anomaly detection
"""
import logging
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class DataPoint(BaseModel):
    """Single time-series data point"""
    timestamp: str
    value: float


class DetectAnomalyRequest(BaseModel):
    """Request for anomaly detection"""
    metric_name: str
    service_name: str
    data_points: List[DataPoint]
    sensitivity: float = 2.0


class AnomalyResult(BaseModel):
    """Single detected anomaly"""
    timestamp: str
    value: float
    expected: float
    deviation: float
    severity: str


class AnomalySummary(BaseModel):
    """Summary of anomaly detection results"""
    total_points: int
    anomaly_count: int
    anomaly_rate: float


def _detect_anomalies_zscore(
    data_points: List[DataPoint],
    sensitivity: float,
    window_size: int = 5,
) -> List[dict]:
    """
    Detect anomalies using z-score method.
    For each point, compute mean and stddev of surrounding window,
    flag if |value - mean| > sensitivity * stddev.
    """
    import statistics

    anomalies = []
    n = len(data_points)

    for i in range(n):
        # Build window: points before and after (exclude current)
        half = window_size // 2
        start = max(0, i - half)
        end = min(n, i + half + 1)

        window_values = [
            data_points[j].value
            for j in range(start, end)
            if j != i and 0 <= j < n
        ]

        if len(window_values) < 2:
            continue

        mean_val = statistics.mean(window_values)
        std_val = statistics.stdev(window_values)

        if std_val == 0:
            continue

        value = data_points[i].value
        z_score = abs(value - mean_val) / std_val

        if z_score > sensitivity:
            deviation = value - mean_val
            severity = "critical" if z_score > sensitivity * 1.5 else "warning"
            anomalies.append({
                "timestamp": data_points[i].timestamp,
                "value": value,
                "expected": round(mean_val, 4),
                "deviation": round(deviation, 4),
                "severity": severity,
            })

    return anomalies


@router.post("/detect")
async def detect_anomalies(request: DetectAnomalyRequest) -> dict:
    """
    Analyze a time-series array and detect anomalies using z-score method.
    """
    if len(request.data_points) < 3:
        return {
            "anomalies": [],
            "summary": {
                "total_points": len(request.data_points),
                "anomaly_count": 0,
                "anomaly_rate": 0.0,
            },
        }

    anomalies = _detect_anomalies_zscore(
        request.data_points,
        request.sensitivity,
    )

    total = len(request.data_points)
    count = len(anomalies)
    rate = (count / total * 100) if total > 0 else 0.0

    return {
        "anomalies": anomalies,
        "summary": {
            "total_points": total,
            "anomaly_count": count,
            "anomaly_rate": round(rate, 2),
        },
    }


# Mock data for active anomalies
MOCK_ACTIVE_ANOMALIES = [
    {
        "id": "anom-001",
        "metric_name": "cpu_percent",
        "service_name": "api-gateway",
        "timestamp": "2025-02-13T10:15:00Z",
        "value": 94.2,
        "expected": 45.0,
        "severity": "critical",
        "status": "active",
    },
    {
        "id": "anom-002",
        "metric_name": "memory_percent",
        "service_name": "payment-service",
        "timestamp": "2025-02-13T10:12:00Z",
        "value": 89.5,
        "expected": 62.0,
        "severity": "warning",
        "status": "active",
    },
    {
        "id": "anom-003",
        "metric_name": "request_latency_p99",
        "service_name": "auth-service",
        "timestamp": "2025-02-13T10:10:00Z",
        "value": 2500.0,
        "expected": 150.0,
        "severity": "critical",
        "status": "active",
    },
    {
        "id": "anom-004",
        "metric_name": "error_rate",
        "service_name": "notification-service",
        "timestamp": "2025-02-13T10:08:00Z",
        "value": 12.5,
        "expected": 0.5,
        "severity": "critical",
        "status": "active",
    },
    {
        "id": "anom-005",
        "metric_name": "disk_usage",
        "service_name": "db-replica-1",
        "timestamp": "2025-02-13T10:05:00Z",
        "value": 92.0,
        "expected": 78.0,
        "severity": "warning",
        "status": "active",
    },
]


@router.get("/active")
async def list_active_anomalies() -> dict:
    """
    List currently active anomalies across services.
    Returns mock data showing 3-5 active anomalies.
    """
    return {"anomalies": MOCK_ACTIVE_ANOMALIES, "count": len(MOCK_ACTIVE_ANOMALIES)}
