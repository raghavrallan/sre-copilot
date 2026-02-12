"""
Incident Correlation endpoints - Find correlated incidents and root cause suggestions
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Time window for correlation (30 minutes)
TIME_PROXIMITY_MINUTES = 30


class CorrelationAnalyzeRequest(BaseModel):
    """Request for incident correlation analysis"""
    incident_id: str
    service_name: str
    severity: str
    detected_at: str
    symptoms: List[str] = []


class CorrelatedIncident(BaseModel):
    """A correlated incident"""
    incident_id: str
    service_name: str
    correlation_score: float
    correlation_type: str
    description: str


# Mock incident database for correlation
MOCK_INCIDENTS = [
    {"incident_id": "INC-001", "service_name": "api-gateway", "severity": "critical", "detected_at": "2025-02-13T10:15:00Z", "symptoms": ["high cpu", "latency spike"]},
    {"incident_id": "INC-002", "service_name": "api-gateway", "severity": "warning", "detected_at": "2025-02-13T10:20:00Z", "symptoms": ["high cpu", "memory pressure"]},
    {"incident_id": "INC-003", "service_name": "auth-service", "severity": "critical", "detected_at": "2025-02-13T10:12:00Z", "symptoms": ["timeout", "latency spike"]},
    {"incident_id": "INC-004", "service_name": "payment-service", "severity": "warning", "detected_at": "2025-02-13T10:18:00Z", "symptoms": ["error rate", "timeout"]},
    {"incident_id": "INC-005", "service_name": "cache-service", "severity": "critical", "detected_at": "2025-02-13T09:50:00Z", "symptoms": ["connection refused", "high cpu"]},
]


def _parse_datetime(dt_str: str) -> datetime:
    """Parse ISO format datetime string."""
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return datetime.utcnow()


def _correlate_incidents(
    incident_id: str,
    service_name: str,
    severity: str,
    detected_at: str,
    symptoms: List[str],
) -> tuple[List[dict], str]:
    """
    Correlate by:
    - Time proximity (within 30 min)
    - Same service
    - Matching symptoms
    """
    try:
        ref_dt = _parse_datetime(detected_at)
    except Exception:
        ref_dt = datetime.utcnow()

    time_window = timedelta(minutes=TIME_PROXIMITY_MINUTES)
    correlated = []

    for inc in MOCK_INCIDENTS:
        if inc["incident_id"] == incident_id:
            continue

        inc_dt = _parse_datetime(inc["detected_at"])
        time_diff = abs((ref_dt - inc_dt).total_seconds())

        score = 0.0
        corr_types = []

        # Time proximity: within 30 min
        if time_diff <= time_window.total_seconds():
            time_score = 1.0 - (time_diff / time_window.total_seconds()) * 0.5
            score += time_score * 0.4
            corr_types.append("time_proximity")

        # Same service
        if inc["service_name"] == service_name:
            score += 0.4
            corr_types.append("same_service")

        # Matching symptoms
        matching_symptoms = set(symptoms) & set(inc["symptoms"])
        if matching_symptoms:
            symptom_score = min(0.5, len(matching_symptoms) * 0.2)
            score += symptom_score
            corr_types.append("matching_symptoms")

        if score > 0:
            desc_parts = []
            if "time_proximity" in corr_types:
                desc_parts.append(f"Detected within {int(time_diff / 60)} min")
            if "same_service" in corr_types:
                desc_parts.append(f"Same service: {inc['service_name']}")
            if "matching_symptoms" in corr_types:
                desc_parts.append(f"Shared symptoms: {', '.join(matching_symptoms)}")

            correlated.append({
                "incident_id": inc["incident_id"],
                "service_name": inc["service_name"],
                "correlation_score": round(min(1.0, score), 2),
                "correlation_type": "+".join(corr_types),
                "description": "; ".join(desc_parts),
            })

    # Sort by correlation score descending
    correlated.sort(key=lambda x: x["correlation_score"], reverse=True)

    # Root cause suggestion based on correlations
    if correlated:
        top = correlated[0]
        if "same_service" in top["correlation_type"]:
            root_cause = f"Multiple incidents in {top['service_name']} suggest a service-level issue (deployment, config, or dependency)."
        elif "time_proximity" in top["correlation_type"]:
            root_cause = "Temporally clustered incidents suggest a cascading failure or shared upstream cause."
        else:
            root_cause = "Correlated incidents share similar symptoms; investigate common dependencies or infrastructure."
    else:
        root_cause = "No strong correlations found. This may be an isolated incident."

    return correlated[:10], root_cause


@router.post("/analyze")
async def analyze_correlation(request: CorrelationAnalyzeRequest) -> dict:
    """
    Given an incident_id and context, find correlated incidents.
    Uses heuristics: time proximity (within 30min), same service, matching symptoms.
    """
    correlated, root_cause = _correlate_incidents(
        request.incident_id,
        request.service_name,
        request.severity,
        request.detected_at,
        request.symptoms or [],
    )

    return {
        "correlated_incidents": correlated,
        "root_cause_suggestion": root_cause,
    }


# Mock correlation groups
MOCK_CORRELATION_GROUPS = [
    {
        "group_id": "group-001",
        "incident_ids": ["INC-001", "INC-002", "INC-003"],
        "services": ["api-gateway", "auth-service"],
        "correlation_type": "cascading_failure",
        "first_detected": "2025-02-13T10:10:00Z",
        "incident_count": 3,
    },
    {
        "group_id": "group-002",
        "incident_ids": ["INC-004", "INC-005"],
        "services": ["payment-service", "cache-service"],
        "correlation_type": "shared_dependency",
        "first_detected": "2025-02-13T09:45:00Z",
        "incident_count": 2,
    },
    {
        "group_id": "group-003",
        "incident_ids": ["INC-006", "INC-007"],
        "services": ["notification-service", "worker-service"],
        "correlation_type": "same_service",
        "first_detected": "2025-02-13T09:30:00Z",
        "incident_count": 2,
    },
]


@router.get("/groups")
async def list_correlation_groups() -> dict:
    """
    List incident correlation groups (clusters of related incidents).
    Returns mock data showing 3 groups.
    """
    return {"groups": MOCK_CORRELATION_GROUPS, "count": len(MOCK_CORRELATION_GROUPS)}
