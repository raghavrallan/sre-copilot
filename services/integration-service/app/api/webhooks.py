"""
Webhook endpoints for receiving alerts from external systems
"""
from fastapi import APIRouter, HTTPException, Request, Header
from typing import List, Optional
from datetime import datetime
from asgiref.sync import sync_to_async
import json
import sys
import os

# Add shared to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../../..'))

from app.models.webhooks import AlertManagerWebhook, GrafanaWebhook
from app.services.incident_client import IncidentClient

router = APIRouter()
incident_client = IncidentClient()

# Default project ID for legacy webhooks (backwards compatibility)
DEFAULT_PROJECT_ID = "af98d006-d24f-4e57-be34-4e2d3b1c2a61"


# ============================================================================
# DATABASE HELPERS
# ============================================================================

@sync_to_async
def get_monitoring_integration(integration_id: str):
    """Get monitoring integration from database"""
    try:
        from shared.models.monitoring_integration import MonitoringIntegration
        integration = MonitoringIntegration.objects.select_related('project').get(id=integration_id)
        return integration
    except Exception as e:
        print(f"Error getting monitoring integration: {e}")
        return None


@sync_to_async
def store_monitoring_alert(integration_id: str, alert_data: dict, incident_id: str = None):
    """Store alert in database"""
    try:
        from shared.models.monitoring_integration import MonitoringAlert
        alert = MonitoringAlert.objects.create(
            integration_id=integration_id,
            alert_name=alert_data.get('alert_name'),
            status=alert_data.get('status', 'firing'),
            severity=alert_data.get('severity', 'medium'),
            summary=alert_data.get('summary', ''),
            description=alert_data.get('description'),
            labels=alert_data.get('labels', {}),
            annotations=alert_data.get('annotations', {}),
            starts_at=alert_data.get('starts_at', datetime.now()),
            external_url=alert_data.get('external_url'),
            fingerprint=alert_data.get('fingerprint'),
            incident_id=incident_id,
            raw_payload=alert_data.get('raw_payload', {})
        )
        return alert
    except Exception as e:
        print(f"Error storing monitoring alert: {e}")
        return None


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

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


# ============================================================================
# NEW DATABASE-BACKED WEBHOOK ENDPOINTS
# ============================================================================

@router.post("/webhooks/{integration_type}/{integration_id}")
async def monitoring_webhook(
    integration_type: str,
    integration_id: str,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None)
):
    """
    Universal webhook endpoint for all monitoring integrations

    Supports: prometheus, alertmanager, grafana

    This endpoint:
    1. Validates the integration exists in database
    2. Verifies webhook secret (if configured)
    3. Uses the project_id from the integration
    4. Stores the alert in database
    5. Creates incident

    Path parameters:
    - integration_type: 'prometheus', 'alertmanager', or 'grafana'
    - integration_id: UUID of the monitoring integration

    Headers:
    - X-Webhook-Secret: Secret token for authentication (optional but recommended)
    """
    # Get integration from database
    integration = await get_monitoring_integration(integration_id)

    if not integration:
        raise HTTPException(
            status_code=404,
            detail=f"Monitoring integration {integration_id} not found"
        )

    # Verify webhook secret if configured
    if integration.webhook_secret and integration.webhook_enabled:
        if not x_webhook_secret:
            raise HTTPException(
                status_code=401,
                detail="X-Webhook-Secret header required"
            )

        if x_webhook_secret != integration.webhook_secret:
            raise HTTPException(
                status_code=403,
                detail="Invalid webhook secret"
            )

    # Get project_id from integration
    project_id = str(integration.project_id)

    # Parse webhook based on integration type
    body = await request.json()

    if integration_type in ['prometheus', 'alertmanager']:
        return await process_alertmanager_webhook(body, integration_id, project_id)
    elif integration_type == 'grafana':
        return await process_grafana_webhook(body, integration_id, project_id)
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported integration type: {integration_type}"
        )


async def process_alertmanager_webhook(body: dict, integration_id: str, project_id: str):
    """Process Prometheus/AlertManager webhook"""
    try:
        webhook = AlertManagerWebhook(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid AlertManager webhook format: {str(e)}")

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

        print(f"Creating incident for alert: {alertname} ({severity}) in project {project_id}")

        incident = await incident_client.create_incident(
            title=title,
            description=full_description,
            service_name=service,
            severity=map_severity(severity),
            project_id=project_id
        )

        if incident:
            incident_id = incident["id"]
            created_incidents.append(incident_id)
            print(f"✅ Created incident {incident_id} for alert {alertname}")

            # Store alert in database
            alert_data = {
                'alert_name': alertname,
                'status': 'firing',
                'severity': map_severity(severity),
                'summary': summary,
                'description': description,
                'labels': dict(alert.labels),
                'annotations': dict(alert.annotations),
                'starts_at': datetime.fromisoformat(alert.startsAt.replace('Z', '+00:00')) if alert.startsAt else datetime.now(),
                'external_url': alert.generatorURL,
                'fingerprint': alert.fingerprint,
                'raw_payload': body
            }
            await store_monitoring_alert(integration_id, alert_data, incident_id)
        else:
            print(f"❌ Failed to create incident for alert {alertname}")

    return {
        "status": "success",
        "message": f"Processed {len(webhook.alerts)} alerts, created {len(created_incidents)} incidents",
        "incident_ids": created_incidents
    }


async def process_grafana_webhook(body: dict, integration_id: str, project_id: str):
    """Process Grafana webhook"""
    try:
        webhook = GrafanaWebhook(**body)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Grafana webhook format: {str(e)}")

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

        print(f"Creating incident for Grafana alert: {alert.title} in project {project_id}")

        # Grafana doesn't always provide service info, use default
        service_name = "grafana-monitored-service"

        incident = await incident_client.create_incident(
            title=title,
            description=description,
            service_name=service_name,
            severity="medium",  # Grafana doesn't provide severity, use medium as default
            project_id=project_id
        )

        if incident:
            incident_id = incident["id"]
            created_incidents.append(incident_id)
            print(f"✅ Created incident {incident_id} for Grafana alert {alert.title}")

            # Store alert in database
            alert_data = {
                'alert_name': alert.title,
                'status': 'firing',
                'severity': 'medium',
                'summary': alert.title,
                'description': alert.message,
                'labels': {},
                'annotations': {},
                'starts_at': datetime.now(),
                'external_url': f"http://grafana:3000/d/{webhook.dashboardId}" if webhook.dashboardId else None,
                'fingerprint': alert.uid,
                'raw_payload': body
            }
            await store_monitoring_alert(integration_id, alert_data, incident_id)
        else:
            print(f"❌ Failed to create incident for Grafana alert {alert.title}")

    return {
        "status": "success",
        "message": f"Processed {len(webhook.alerts)} alerts, created {len(created_incidents)} incidents",
        "incident_ids": created_incidents
    }


# ============================================================================
# LEGACY WEBHOOK ENDPOINTS (BACKWARDS COMPATIBILITY)
# ============================================================================

@router.post("/webhooks/alertmanager")
async def alertmanager_webhook_legacy(webhook: AlertManagerWebhook):
    """
    LEGACY: Receive alerts from Prometheus AlertManager (backwards compatible)

    This endpoint uses the hardcoded DEFAULT_PROJECT_ID for backwards compatibility.
    New integrations should use /webhooks/prometheus/{integration_id} instead.
    """
    print("⚠️  WARNING: Using legacy AlertManager webhook endpoint with hardcoded project_id")
    print("    Please migrate to /webhooks/prometheus/{integration_id} for proper project routing")

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
            project_id=DEFAULT_PROJECT_ID
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
async def grafana_webhook_legacy(webhook: GrafanaWebhook):
    """
    LEGACY: Receive alerts from Grafana (backwards compatible)

    This endpoint uses the hardcoded DEFAULT_PROJECT_ID for backwards compatibility.
    New integrations should use /webhooks/grafana/{integration_id} instead.
    """
    print("⚠️  WARNING: Using legacy Grafana webhook endpoint with hardcoded project_id")
    print("    Please migrate to /webhooks/grafana/{integration_id} for proper project routing")

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
            project_id=DEFAULT_PROJECT_ID
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
