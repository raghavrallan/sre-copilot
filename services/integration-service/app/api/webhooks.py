"""
Webhook endpoints for receiving alerts from external systems
"""
from fastapi import APIRouter, HTTPException, Request
from typing import List
import json

from app.models.webhooks import AlertManagerWebhook, GrafanaWebhook
from app.services.incident_client import IncidentClient

router = APIRouter()
incident_client = IncidentClient()

# Default tenant ID (in production, this would be determined by auth/routing)
DEFAULT_TENANT_ID = "e56947c7-554b-4ea8-9d88-97b16477b077"


def map_severity(severity: str) -> str:
    """
    Map external severity levels to internal severity levels

    Args:
        severity: External severity (critical, warning, info, etc.)

    Returns:
        Internal severity (critical, high, medium, low)
    """
    severity_lower = severity.lower()

    if severity_lower in ["critical", "emergency", "fatal"]:
        return "critical"
    elif severity_lower in ["high", "error"]:
        return "high"
    elif severity_lower in ["warning", "warn"]:
        return "medium"
    else:
        return "low"


@router.post("/webhooks/alertmanager")
async def alertmanager_webhook(webhook: AlertManagerWebhook):
    """
    Receive alerts from Prometheus AlertManager

    AlertManager groups multiple alerts and sends them in batches.
    We create one incident per firing alert.
    """
    created_incidents = []

    # Process each alert
    for alert in webhook.alerts:
        # Only create incidents for firing alerts
        if alert.status != "firing":
            print(f"Skipping resolved alert: {alert.labels.alertname}")
            continue

        # Extract alert details
        alertname = alert.labels.alertname
        severity = alert.labels.severity
        service = alert.labels.service or "unknown"
        summary = alert.annotations.summary
        description = alert.annotations.description or ""

        # Create incident
        title = f"[{severity.upper()}] {alertname} on {service}"
        full_description = f"{summary}\n\n{description}"

        if alert.generatorURL:
            full_description += f"\n\nPrometheus: {alert.generatorURL}"

        print(f"Creating incident for alert: {alertname} ({severity})")

        incident = await incident_client.create_incident(
            title=title,
            description=full_description,
            service_name=service,
            severity=map_severity(severity),
            tenant_id=DEFAULT_TENANT_ID
        )

        if incident:
            created_incidents.append(incident["id"])
            print(f"✅ Created incident {incident['id']} for alert {alertname}")
        else:
            print(f"❌ Failed to create incident for alert {alertname}")

    return {
        "status": "success",
        "message": f"Processed {len(webhook.alerts)} alerts, created {len(created_incidents)} incidents",
        "incident_ids": created_incidents
    }


@router.post("/webhooks/grafana")
async def grafana_webhook(webhook: GrafanaWebhook):
    """
    Receive alerts from Grafana

    Grafana sends alerts when dashboard thresholds are breached.
    We create one incident per alerting alert.
    """
    created_incidents = []

    # Process each alert
    for alert in webhook.alerts:
        # Only create incidents for alerting state
        if alert.state != "alerting":
            print(f"Skipping non-alerting alert: {alert.title}")
            continue

        # Extract alert details
        title = f"[GRAFANA] {alert.title}"
        description = alert.message or webhook.message or "No description provided"

        # Add dashboard link if available
        if webhook.dashboardId and webhook.panelId:
            dashboard_url = f"http://grafana:3000/d/{webhook.dashboardId}?panelId={webhook.panelId}"
            description += f"\n\nGrafana Dashboard: {dashboard_url}"

        print(f"Creating incident for Grafana alert: {alert.title}")

        # Grafana doesn't always provide service info, use default
        service_name = "grafana-monitored-service"

        incident = await incident_client.create_incident(
            title=title,
            description=description,
            service_name=service_name,
            severity="medium",  # Grafana doesn't provide severity, use medium as default
            tenant_id=DEFAULT_TENANT_ID
        )

        if incident:
            created_incidents.append(incident["id"])
            print(f"✅ Created incident {incident['id']} for Grafana alert {alert.title}")
        else:
            print(f"❌ Failed to create incident for Grafana alert {alert.title}")

    return {
        "status": "success",
        "message": f"Processed {len(webhook.alerts)} alerts, created {len(created_incidents)} incidents",
        "incident_ids": created_incidents
    }


@router.post("/webhooks/test")
async def test_webhook(request: Request):
    """
    Test endpoint to receive any webhook payload for debugging
    """
    body = await request.json()
    print(f"Received test webhook:")
    print(json.dumps(body, indent=2))

    return {
        "status": "success",
        "message": "Test webhook received",
        "payload": body
    }
