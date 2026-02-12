"""Generate demo alert conditions, policies, channels, active alerts, and muting rules."""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


def generate_demo_conditions() -> List[Dict[str, Any]]:
    """Generate demo alert conditions."""
    conditions = [
        {
            "condition_id": str(uuid.uuid4()),
            "name": "High Error Rate",
            "metric_name": "http.request.error_rate",
            "operator": "gt",
            "threshold": 5.0,
            "duration_seconds": 300,
            "severity": "critical",
            "service_name": "api-gateway",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z",
        },
        {
            "condition_id": str(uuid.uuid4()),
            "name": "P95 Latency Spike",
            "metric_name": "http.request.duration_p95",
            "operator": "gt",
            "threshold": 500.0,
            "duration_seconds": 180,
            "severity": "warning",
            "service_name": "auth-service",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=5)).isoformat() + "Z",
        },
        {
            "condition_id": str(uuid.uuid4()),
            "name": "CPU High",
            "metric_name": "host.cpu_percent",
            "operator": "gte",
            "threshold": 90.0,
            "duration_seconds": 600,
            "severity": "warning",
            "service_name": "sre-prod-01",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=3)).isoformat() + "Z",
        },
        {
            "condition_id": str(uuid.uuid4()),
            "name": "Memory Critical",
            "metric_name": "host.memory_percent",
            "operator": "gte",
            "threshold": 95.0,
            "duration_seconds": 300,
            "severity": "critical",
            "service_name": "sre-prod-02",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat() + "Z",
        },
        {
            "condition_id": str(uuid.uuid4()),
            "name": "Low Availability",
            "metric_name": "service.availability",
            "operator": "lt",
            "threshold": 99.0,
            "duration_seconds": 900,
            "severity": "critical",
            "service_name": "incident-service",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=1)).isoformat() + "Z",
        },
    ]
    logger.info("Generated %d demo alert conditions", len(conditions))
    return conditions


def generate_demo_policies(condition_ids: List[str]) -> List[Dict[str, Any]]:
    """Generate demo alert policies."""
    policies = [
        {
            "policy_id": str(uuid.uuid4()),
            "name": "Production Critical Alerts",
            "description": "Critical alerts for production services",
            "condition_ids": condition_ids[:2] if len(condition_ids) >= 2 else condition_ids,
            "incident_preference": "per_condition",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=7)).isoformat() + "Z",
        },
        {
            "policy_id": str(uuid.uuid4()),
            "name": "Infrastructure Alerts",
            "description": "Host and infrastructure metrics",
            "condition_ids": condition_ids[2:4] if len(condition_ids) >= 4 else [],
            "incident_preference": "per_policy",
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=5)).isoformat() + "Z",
        },
    ]
    logger.info("Generated %d demo alert policies", len(policies))
    return policies


def generate_demo_channels() -> List[Dict[str, Any]]:
    """Generate demo notification channels."""
    channels = [
        {
            "channel_id": str(uuid.uuid4()),
            "name": "Ops Team Email",
            "type": "email",
            "config": {"emails": ["ops@sre-copilot.example.com", "oncall@sre-copilot.example.com"]},
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=10)).isoformat() + "Z",
        },
        {
            "channel_id": str(uuid.uuid4()),
            "name": "SRE Slack Channel",
            "type": "slack",
            "config": {"webhook_url": "https://hooks.slack.com/services/xxx", "channel": "#sre-alerts"},
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=8)).isoformat() + "Z",
        },
        {
            "channel_id": str(uuid.uuid4()),
            "name": "PagerDuty Integration",
            "type": "pagerduty",
            "config": {"integration_key": "xxx", "severity_mapping": {"critical": "critical", "warning": "high"}},
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=6)).isoformat() + "Z",
        },
        {
            "channel_id": str(uuid.uuid4()),
            "name": "Custom Webhook",
            "type": "webhook",
            "config": {"url": "https://example.com/webhook/alerts", "secret": "***"},
            "enabled": True,
            "created_at": (datetime.utcnow() - timedelta(days=4)).isoformat() + "Z",
        },
        {
            "channel_id": str(uuid.uuid4()),
            "name": "MS Teams Alerts",
            "type": "msteams",
            "config": {"webhook_url": "https://outlook.office.com/webhook/xxx"},
            "enabled": False,
            "created_at": (datetime.utcnow() - timedelta(days=2)).isoformat() + "Z",
        },
    ]
    logger.info("Generated %d demo notification channels", len(channels))
    return channels


def generate_demo_active_alerts(condition_ids: List[str]) -> List[Dict[str, Any]]:
    """Generate demo active alerts."""
    now = datetime.utcnow()
    alerts = [
        {
            "alert_id": str(uuid.uuid4()),
            "condition_id": condition_ids[0] if condition_ids else "",
            "fired_at": (now - timedelta(minutes=15)).isoformat() + "Z",
            "severity": "critical",
            "message": "Error rate exceeded 5% for 5 minutes",
            "current_value": 7.2,
            "threshold": 5.0,
            "status": "firing",
            "acknowledged": False,
        },
        {
            "alert_id": str(uuid.uuid4()),
            "condition_id": condition_ids[1] if len(condition_ids) > 1 else "",
            "fired_at": (now - timedelta(minutes=45)).isoformat() + "Z",
            "severity": "warning",
            "message": "P95 latency exceeded 500ms for 3 minutes",
            "current_value": 580.0,
            "threshold": 500.0,
            "status": "firing",
            "acknowledged": True,
        },
    ]
    logger.info("Generated %d demo active alerts", len(alerts))
    return alerts


def generate_demo_muting_rules(condition_ids: List[str]) -> List[Dict[str, Any]]:
    """Generate demo muting rules."""
    now = datetime.utcnow()
    rules = [
        {
            "rule_id": str(uuid.uuid4()),
            "name": "Nightly Maintenance Window",
            "condition_ids": condition_ids[:2] if len(condition_ids) >= 2 else [],
            "match_criteria": {},
            "start_time": (now.replace(hour=2, minute=0, second=0) + timedelta(days=1)).isoformat() + "Z",
            "end_time": (now.replace(hour=4, minute=0, second=0) + timedelta(days=1)).isoformat() + "Z",
            "repeat": "daily",
            "description": "Suppress alerts during nightly maintenance",
            "enabled": True,
            "created_at": (now - timedelta(days=3)).isoformat() + "Z",
        },
        {
            "rule_id": str(uuid.uuid4()),
            "name": "Weekend Low-Priority",
            "condition_ids": [],
            "match_criteria": {"severity": "info"},
            "start_time": (now - timedelta(days=1)).replace(hour=0, minute=0, second=0).isoformat() + "Z",
            "end_time": (now + timedelta(days=1)).replace(hour=23, minute=59, second=59).isoformat() + "Z",
            "repeat": "weekly",
            "description": "Mute info-level alerts on weekends",
            "enabled": True,
            "created_at": (now - timedelta(days=5)).isoformat() + "Z",
        },
    ]
    logger.info("Generated %d demo muting rules", len(rules))
    return rules


def seed_demo_data() -> None:
    """Seed all demo data into storage."""
    from app.storage import (
        alert_conditions,
        alert_policies,
        notification_channels,
        muting_rules,
        active_alerts,
    )

    if not alert_conditions:
        conditions = generate_demo_conditions()
        alert_conditions.extend(conditions)
        condition_ids = [c["condition_id"] for c in conditions]

        if not alert_policies:
            alert_policies.extend(generate_demo_policies(condition_ids))
        if not active_alerts:
            active_alerts.extend(generate_demo_active_alerts(condition_ids))
        if not muting_rules:
            muting_rules.extend(generate_demo_muting_rules(condition_ids))

    if not notification_channels:
        notification_channels.extend(generate_demo_channels())
