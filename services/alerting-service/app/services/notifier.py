"""Notification delivery to configured channels"""
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

import httpx
from asgiref.sync import sync_to_async

logger = logging.getLogger(__name__)


async def send_notifications(condition, alert):
    """Send alert notification to all channels in the condition's policy"""
    if not condition.policy:
        return

    def _get_channels():
        return list(
            condition.policy.notification_channels.filter(is_enabled=True)
        )

    channels = await sync_to_async(_get_channels)()

    for channel in channels:
        try:
            await send_to_channel(channel, alert)
        except Exception as e:
            logger.error("Failed to notify channel %s: %s", channel.name, e)


async def send_to_channel(channel, alert):
    """Send to a specific channel type"""
    if channel.channel_type == "slack":
        await send_slack(channel.config, alert)
    elif channel.channel_type == "email":
        await send_email(channel.config, alert)
    elif channel.channel_type == "pagerduty":
        await send_pagerduty(channel.config, alert)
    elif channel.channel_type == "teams":
        await send_teams(channel.config, alert)
    elif channel.channel_type == "webhook":
        await send_webhook(channel.config, alert)


async def send_slack(config, alert):
    """Send Slack notification via webhook"""
    webhook_url = config.get("webhook_url")
    if not webhook_url:
        return

    payload = {
        "text": (
            f"🚨 *{alert.title}*\n"
            f"{alert.description}\n"
            f"Severity: {alert.severity}\n"
            f"Service: {alert.service_name}"
        )
    }
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload)


async def send_email(config, alert):
    """Send email notification via SMTP"""
    smtp_host = config.get("smtp_host")
    smtp_port = config.get("smtp_port", 587)
    smtp_user = config.get("smtp_user")
    smtp_password = config.get("smtp_password")
    from_email = config.get("from_email")
    to_emails = config.get("to_emails", [])

    if not all([smtp_host, from_email, to_emails]):
        logger.warning("Email config incomplete: missing smtp_host, from_email, or to_emails")
        return

    def _send():
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{alert.severity}] {alert.title}"
        msg["From"] = from_email
        msg["To"] = ", ".join(to_emails)

        body = (
            f"{alert.title}\n\n"
            f"{alert.description}\n\n"
            f"Severity: {alert.severity}\n"
            f"Service: {alert.service_name or 'N/A'}\n"
        )
        if alert.metric_value is not None:
            body += f"Metric Value: {alert.metric_value}\n"
        msg.attach(MIMEText(body, "plain"))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.sendmail(from_email, to_emails, msg.as_string())

    await sync_to_async(_send)()


async def send_pagerduty(config, alert):
    """Send PagerDuty notification via Events API v2"""
    routing_key = config.get("routing_key") or config.get("integration_key")
    if not routing_key:
        return

    payload = {
        "routing_key": routing_key,
        "event_action": "trigger",
        "dedup_key": str(alert.id),
        "payload": {
            "summary": alert.title,
            "severity": "critical" if alert.severity == "critical" else "error",
            "source": alert.service_name or "sre-copilot",
            "custom_details": {
                "description": alert.description,
                "severity": alert.severity,
                "service_name": alert.service_name,
                "metric_value": alert.metric_value,
            },
        },
    }
    async with httpx.AsyncClient() as client:
        await client.post(
            "https://events.pagerduty.com/v2/enqueue",
            json=payload,
        )


async def send_teams(config, alert):
    """Send Microsoft Teams notification via webhook"""
    webhook_url = config.get("webhook_url")
    if not webhook_url:
        return

    payload = {
        "@type": "MessageCard",
        "@context": "https://schema.org/extensions",
        "summary": alert.title,
        "themeColor": "d32f2f" if alert.severity == "critical" else "ff9800",
        "title": f"🚨 {alert.title}",
        "text": (
            f"{alert.description}\n\n"
            f"**Severity:** {alert.severity}\n"
            f"**Service:** {alert.service_name or 'N/A'}"
        ),
    }
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload)


async def send_webhook(config, alert):
    """Send to generic webhook URL"""
    webhook_url = config.get("webhook_url") or config.get("url")
    if not webhook_url:
        return

    payload = {
        "title": alert.title,
        "description": alert.description,
        "severity": alert.severity,
        "service_name": alert.service_name,
        "metric_value": alert.metric_value,
        "status": alert.status,
        "fired_at": alert.fired_at.isoformat() if alert.fired_at else None,
    }
    async with httpx.AsyncClient() as client:
        await client.post(webhook_url, json=payload)
