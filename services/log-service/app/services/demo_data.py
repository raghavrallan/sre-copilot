"""
Generate demo log entries for development and testing.
"""
import logging
import random
from datetime import datetime, timedelta
from typing import List

from app.api.logs import LogEntry

logger = logging.getLogger(__name__)

SERVICES = [
    "api-gateway",
    "auth-service",
    "incident-service",
    "ai-service",
    "integration-service",
    "websocket-service",
    "audit-service",
]

LOG_TEMPLATES = {
    "api-gateway": [
        ("INFO", "Request processed in {ms}ms", {}),
        ("INFO", "Rate limit check passed for client {ip}", {}),
        ("INFO", "Proxying request to {service} service", {}),
        ("WARN", "Slow response from downstream: {ms}ms", {}),
        ("WARN", "Rate limit approaching for client {ip}", {}),
        ("ERROR", "Upstream service unavailable: {service}", {}),
        ("ERROR", "Request timeout after {ms}ms", {}),
        ("DEBUG", "Request headers: {count} items", {}),
    ],
    "auth-service": [
        ("INFO", "User login successful for {user}", {}),
        ("INFO", "Token refresh completed", {}),
        ("INFO", "Password reset initiated for {user}", {}),
        ("WARN", "JWT token expired for user {user}", {}),
        ("WARN", "Multiple failed login attempts from {ip}", {}),
        ("ERROR", "Failed to connect to database", {}),
        ("ERROR", "Invalid credentials for user {user}", {}),
        ("DEBUG", "Session validation cache hit", {}),
    ],
    "incident-service": [
        ("INFO", "Incident created: INC-{id}", {}),
        ("INFO", "Incident {id} status updated to {status}", {}),
        ("INFO", "Workflow step completed: {step}", {}),
        ("WARN", "Escalation triggered for incident INC-{id}", {}),
        ("WARN", "SLA breach approaching for INC-{id}", {}),
        ("ERROR", "Failed to persist incident state", {}),
        ("ERROR", "Webhook delivery failed: {url}", {}),
        ("FATAL", "Database connection lost - cannot persist incidents", {}),
    ],
    "ai-service": [
        ("INFO", "Analysis request received for incident {id}", {}),
        ("INFO", "LLM inference completed in {ms}ms", {}),
        ("INFO", "Hypothesis generated with confidence {score}", {}),
        ("WARN", "Model rate limit reached, queuing request", {}),
        ("WARN", "Token usage exceeded threshold: {count}", {}),
        ("ERROR", "OpenAI API error: {msg}", {}),
        ("ERROR", "Embedding service timeout", {}),
        ("DEBUG", "Prompt tokens: {count}", {}),
    ],
    "integration-service": [
        ("INFO", "Webhook delivered to {url}", {}),
        ("INFO", "Slack notification sent for INC-{id}", {}),
        ("INFO", "PagerDuty incident created: {id}", {}),
        ("WARN", "Webhook retry attempt {n} for {url}", {}),
        ("WARN", "Integration rate limit, backing off", {}),
        ("ERROR", "Failed to connect to external API", {}),
        ("ERROR", "Webhook signature validation failed", {}),
    ],
    "websocket-service": [
        ("INFO", "Client connected: {id}", {}),
        ("INFO", "Client disconnected: {id}", {}),
        ("INFO", "Broadcasting to {count} subscribers", {}),
        ("WARN", "Connection backlog: {count} pending", {}),
        ("WARN", "Client heartbeat missed: {id}", {}),
        ("ERROR", "Redis pubsub connection lost", {}),
        ("ERROR", "Failed to serialize message", {}),
    ],
    "audit-service": [
        ("INFO", "Audit event recorded: {action}", {}),
        ("INFO", "Compliance report generated for {period}", {}),
        ("INFO", "User {user} performed {action}", {}),
        ("WARN", "Large audit batch: {count} events", {}),
        ("WARN", "Retention policy cleanup initiated", {}),
        ("ERROR", "Audit storage write failed", {}),
        ("DEBUG", "Audit event validated", {}),
    ],
}

TRACE_IDS = [
    "a1b2c3d4e5f6g7h8i9j0",
    "b2c3d4e5f6g7h8i9j0k1",
    "c3d4e5f6g7h8i9j0k1l2",
    "d4e5f6g7h8i9j0k1l2m3",
    "e5f6g7h8i9j0k1l2m3n4",
    "f6g7h8i9j0k1l2m3n4o5",
    "g7h8i9j0k1l2m3n4o5p6",
    None,
    None,
    None,
]

SPAN_IDS = [
    "span-001",
    "span-002",
    "span-003",
    "span-004",
    "span-005",
    None,
    None,
    None,
]


def _format_message(template: str, **kwargs) -> str:
    """Format a message template with placeholders."""
    try:
        return template.format(**kwargs)
    except KeyError:
        return template


def _generate_demo_logs() -> List[LogEntry]:
    """Generate 200+ realistic log entries across all 7 services."""
    logs: List[LogEntry] = []
    now = datetime.utcnow()
    level_weights = {"DEBUG": 3, "INFO": 60, "WARN": 20, "ERROR": 15, "FATAL": 2}

    for _ in range(210):
        service = random.choice(SERVICES)
        templates = LOG_TEMPLATES.get(service, LOG_TEMPLATES["api-gateway"])
        level, template, attrs = random.choice(templates)

        # Override level based on weights
        r = random.randint(1, 100)
        if r <= 3:
            level = "DEBUG"
        elif r <= 63:
            level = "INFO"
        elif r <= 83:
            level = "WARN"
        elif r <= 98:
            level = "ERROR"
        else:
            level = "FATAL"

        # Generate placeholders
        placeholders = {
            "ms": str(random.randint(50, 5000)),
            "ip": f"192.168.{random.randint(1, 255)}.{random.randint(1, 255)}",
            "service": random.choice(["auth", "incident", "ai", "integration"]),
            "user": f"user-{random.randint(1000, 9999)}",
            "count": str(random.randint(1, 500)),
            "id": f"{random.randint(100, 999)}",
            "status": random.choice(["investigating", "acknowledged", "resolved"]),
            "step": f"step-{random.randint(1, 5)}",
            "url": f"https://webhook.example.com/{random.randint(1000, 9999)}",
            "score": f"{random.uniform(0.7, 0.99):.2f}",
            "msg": "rate limit exceeded",
            "n": str(random.randint(1, 5)),
            "action": random.choice(["login", "create_incident", "update_settings"]),
            "period": f"Q{random.randint(1, 4)}-2024",
        }

        try:
            message = _format_message(template, **placeholders)
        except Exception:
            message = template

        # Random timestamp in last 24 hours
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        timestamp = now - timedelta(hours=hours_ago, minutes=minutes_ago)
        timestamp_str = timestamp.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

        trace_id = random.choice(TRACE_IDS)
        span_id = random.choice(SPAN_IDS) if trace_id else None

        logs.append(
            LogEntry(
                timestamp=timestamp_str,
                level=level,
                service_name=service,
                message=message,
                attributes=attrs.copy(),
                trace_id=trace_id,
                span_id=span_id,
            )
        )

    # Sort by timestamp
    logs.sort(key=lambda x: x.timestamp or "")

    logger.info("Generated %d demo log entries across %d services", len(logs), len(SERVICES))
    return logs
