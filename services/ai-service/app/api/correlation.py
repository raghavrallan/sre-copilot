"""
Incident Correlation endpoints - correlate alerts with incidents and
find related incident clusters using heuristics.
"""
import logging
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

TIME_PROXIMITY_MINUTES = 30


class CorrelationAnalyzeRequest(BaseModel):
    incident_id: str
    service_name: str
    severity: str
    detected_at: str
    symptoms: List[str] = []


class AlertIncidentCorrelationRequest(BaseModel):
    """Correlate Grafana alert rules with active incidents."""
    alerts: List[dict] = []
    incidents: List[dict] = []


def _parse_datetime(dt_str: str) -> datetime:
    try:
        return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
    except (ValueError, TypeError):
        return datetime.utcnow()


def _correlate_incidents_list(
    incident_id: str,
    service_name: str,
    severity: str,
    detected_at: str,
    symptoms: List[str],
    incidents_db: List[dict],
) -> tuple[List[dict], str]:
    try:
        ref_dt = _parse_datetime(detected_at)
    except Exception:
        ref_dt = datetime.utcnow()

    time_window = timedelta(minutes=TIME_PROXIMITY_MINUTES)
    correlated = []

    for inc in incidents_db:
        inc_id = inc.get("incident_id") or inc.get("id", "")
        if str(inc_id) == str(incident_id):
            continue

        inc_dt = _parse_datetime(inc.get("detected_at", ""))
        time_diff = abs((ref_dt - inc_dt).total_seconds())

        score = 0.0
        corr_types = []

        if time_diff <= time_window.total_seconds():
            time_score = 1.0 - (time_diff / time_window.total_seconds()) * 0.5
            score += time_score * 0.4
            corr_types.append("time_proximity")

        if inc.get("service_name") == service_name:
            score += 0.4
            corr_types.append("same_service")

        inc_symptoms = inc.get("symptoms", [])
        matching = set(symptoms) & set(inc_symptoms)
        if matching:
            score += min(0.5, len(matching) * 0.2)
            corr_types.append("matching_symptoms")

        if score > 0:
            desc_parts = []
            if "time_proximity" in corr_types:
                desc_parts.append(f"Detected within {int(time_diff / 60)} min")
            if "same_service" in corr_types:
                desc_parts.append(f"Same service: {inc.get('service_name')}")
            if "matching_symptoms" in corr_types:
                desc_parts.append(f"Shared symptoms: {', '.join(matching)}")
            correlated.append({
                "incident_id": str(inc_id),
                "service_name": inc.get("service_name", ""),
                "correlation_score": round(min(1.0, score), 2),
                "correlation_type": "+".join(corr_types),
                "description": "; ".join(desc_parts),
            })

    correlated.sort(key=lambda x: x["correlation_score"], reverse=True)

    if correlated:
        top = correlated[0]
        if "same_service" in top["correlation_type"]:
            root_cause = f"Multiple incidents in {top['service_name']} suggest a service-level issue."
        elif "time_proximity" in top["correlation_type"]:
            root_cause = "Temporally clustered incidents suggest a cascading failure."
        else:
            root_cause = "Correlated incidents share similar symptoms; investigate common dependencies."
    else:
        root_cause = "No strong correlations found. This may be an isolated incident."

    return correlated[:10], root_cause


@router.post("/analyze")
async def analyze_correlation(request: CorrelationAnalyzeRequest) -> dict:
    correlated, root_cause = _correlate_incidents_list(
        request.incident_id,
        request.service_name,
        request.severity,
        request.detected_at,
        request.symptoms or [],
        [],
    )
    return {"correlated_incidents": correlated, "root_cause_suggestion": root_cause}


@router.post("/alert-incident")
async def correlate_alerts_with_incidents(request: AlertIncidentCorrelationRequest) -> dict:
    """Match Grafana alert rules with existing incidents by service name and label overlap."""
    correlations = []
    for alert in request.alerts:
        alert_title = alert.get("title", "")
        alert_labels = alert.get("labels", {})
        alert_service = alert_labels.get("service", alert_labels.get("job", ""))
        alert_state = alert.get("state", "")

        matched_incidents = []
        for inc in request.incidents:
            score = 0.0
            reasons = []
            inc_service = inc.get("service_name", "")

            if alert_service and inc_service and alert_service.lower() in inc_service.lower():
                score += 0.5
                reasons.append("same_service")

            inc_title = inc.get("title", "").lower()
            if alert_title.lower() in inc_title or any(lbl.lower() in inc_title for lbl in alert_labels.values()):
                score += 0.3
                reasons.append("title_match")

            if alert_state in ("alerting", "firing") and inc.get("state") in ("detected", "investigating"):
                score += 0.2
                reasons.append("active_both")

            if score > 0.2:
                matched_incidents.append({
                    "incident_id": inc.get("id", ""),
                    "incident_title": inc.get("title", ""),
                    "correlation_score": round(score, 2),
                    "reasons": reasons,
                })

        matched_incidents.sort(key=lambda x: x["correlation_score"], reverse=True)
        correlations.append({
            "alert_title": alert_title,
            "alert_state": alert_state,
            "matched_incidents": matched_incidents[:3],
            "has_match": len(matched_incidents) > 0,
        })

    return {"correlations": correlations, "total_alerts": len(request.alerts)}


@router.get("/groups")
async def list_correlation_groups() -> dict:
    """List incident correlation groups."""
    return {"groups": [], "count": 0}
