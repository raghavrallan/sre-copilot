"""
Anomaly Detection endpoints - Z-score based time-series anomaly detection
with batch support for multi-metric scanning.
"""
import logging
import statistics
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


class DataPoint(BaseModel):
    timestamp: str
    value: float


class DetectAnomalyRequest(BaseModel):
    metric_name: str
    service_name: str
    data_points: List[DataPoint]
    sensitivity: float = 2.0


class MetricSeries(BaseModel):
    metric_name: str
    service_name: str = ""
    data_points: List[DataPoint]


class BatchDetectRequest(BaseModel):
    series: List[MetricSeries]
    sensitivity: float = 2.0


def _detect_anomalies_zscore(
    data_points: List[DataPoint],
    sensitivity: float,
    window_size: int = 5,
) -> List[dict]:
    anomalies = []
    n = len(data_points)

    for i in range(n):
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
                "z_score": round(z_score, 2),
                "severity": severity,
            })
    return anomalies


@router.post("/detect")
async def detect_anomalies(request: DetectAnomalyRequest) -> dict:
    if len(request.data_points) < 3:
        return {
            "anomalies": [],
            "summary": {"total_points": len(request.data_points), "anomaly_count": 0, "anomaly_rate": 0.0},
        }

    anomalies = _detect_anomalies_zscore(request.data_points, request.sensitivity)
    total = len(request.data_points)
    count = len(anomalies)
    rate = (count / total * 100) if total > 0 else 0.0
    return {
        "anomalies": anomalies,
        "summary": {"total_points": total, "anomaly_count": count, "anomaly_rate": round(rate, 2)},
    }


@router.post("/detect-batch")
async def detect_anomalies_batch(request: BatchDetectRequest) -> dict:
    """Analyze multiple metric series and return anomalies for each."""
    results = []
    total_anomalies = 0
    for s in request.series:
        if len(s.data_points) < 3:
            continue
        anomalies = _detect_anomalies_zscore(s.data_points, request.sensitivity)
        if anomalies:
            total_anomalies += len(anomalies)
            results.append({
                "metric_name": s.metric_name,
                "service_name": s.service_name,
                "anomaly_count": len(anomalies),
                "max_severity": max(a["severity"] for a in anomalies),
                "anomalies": anomalies[-5:],
            })
    results.sort(key=lambda r: (0 if r["max_severity"] == "critical" else 1, -r["anomaly_count"]))
    return {
        "results": results,
        "total_anomalies": total_anomalies,
        "series_scanned": len(request.series),
    }


# In-memory store for detected anomalies (recent scans)
_active_anomalies: list[dict] = []


@router.get("/active")
async def list_active_anomalies() -> dict:
    """List recently detected anomalies from scan results."""
    return {"anomalies": _active_anomalies[-20:], "count": len(_active_anomalies)}


@router.post("/report")
async def report_anomalies(anomalies: List[dict]) -> dict:
    """Store anomalies from gateway scan into the active list."""
    global _active_anomalies
    now = datetime.now(timezone.utc).isoformat()
    for a in anomalies:
        a["id"] = f"anom-{uuid.uuid4().hex[:8]}"
        a["reported_at"] = now
        a["status"] = "active"
    _active_anomalies = (anomalies + _active_anomalies)[:50]
    return {"stored": len(anomalies)}
