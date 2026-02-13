"""
Real alert evaluation engine.
Runs periodically, checks alert conditions against actual metrics from PostgreSQL,
fires alerts when conditions are met, resolves when conditions clear.
"""
import asyncio
import logging
from datetime import timedelta

from asgiref.sync import sync_to_async
from django.db.models import Avg
from django.utils import timezone

from shared.models.observability import (
    AlertCondition,
    ActiveAlert,
    MetricDataPoint,
    Transaction,
    HostMetric,
)
from app.services.notifier import send_notifications

logger = logging.getLogger(__name__)


async def evaluate_all_conditions():
    """Evaluate all enabled alert conditions across all projects"""
    conditions = await sync_to_async(list)(
        AlertCondition.objects.filter(is_enabled=True).select_related("project", "tenant")
    )

    for condition in conditions:
        try:
            await evaluate_condition(condition)
        except Exception as e:
            logger.error("Error evaluating condition %s: %s", condition.id, e)


async def evaluate_condition(condition):
    """Evaluate a single alert condition against recent metrics"""
    project_id = condition.project_id
    metric_name = condition.metric_name
    service_name = condition.service_name
    threshold = condition.threshold
    operator = condition.operator
    duration_minutes = condition.duration_minutes

    # Get recent metric values based on the condition type
    since = timezone.now() - timedelta(minutes=duration_minutes)

    current_value = await get_metric_value(project_id, metric_name, service_name, since)

    if current_value is None:
        return  # No data to evaluate

    is_breached = check_threshold(current_value, operator, threshold)

    # Check if there's already an active alert for this condition
    existing_alert = await sync_to_async(
        lambda: ActiveAlert.objects.filter(
            condition=condition,
            status="firing",
        ).first()
    )()

    if is_breached and not existing_alert:
        # Fire new alert
        alert = await sync_to_async(ActiveAlert.objects.create)(
            project=condition.project,
            tenant=condition.tenant,
            condition=condition,
            title=f"Alert: {condition.name}",
            description=f"{metric_name} is {operator} {threshold} (current: {current_value:.2f})",
            severity=condition.severity,
            status="firing",
            service_name=service_name,
            metric_value=current_value,
        )
        logger.info("Alert fired: %s for project %s", alert.title, project_id)

        # Send notifications
        await send_notifications(condition, alert)

    elif not is_breached and existing_alert:
        # Resolve alert
        existing_alert.status = "resolved"
        existing_alert.resolved_at = timezone.now()
        await sync_to_async(existing_alert.save)()
        logger.info("Alert resolved: %s", existing_alert.title)


async def get_metric_value(project_id, metric_name, service_name, since):
    """Get the current value for a metric"""
    # Try MetricDataPoint first
    queryset = MetricDataPoint.objects.filter(
        project_id=project_id,
        metric_name=metric_name,
        timestamp__gte=since,
    )
    if service_name:
        queryset = queryset.filter(service_name=service_name)

    avg = await sync_to_async(lambda: queryset.aggregate(avg_val=Avg("value")))()
    if avg["avg_val"] is not None:
        return avg["avg_val"]

    # Try derived metrics (error_rate, response_time, cpu, memory)
    if "error_rate" in metric_name:
        return await get_error_rate(project_id, service_name, since)
    elif "response_time" in metric_name or "latency" in metric_name:
        return await get_avg_response_time(project_id, service_name, since)
    elif "cpu" in metric_name:
        return await get_host_metric(project_id, "cpu_percent", since)
    elif "memory" in metric_name:
        return await get_host_metric(project_id, "memory_percent", since)

    return None


async def get_error_rate(project_id, service_name, since):
    """Derive error rate from transactions: (error_count / total) * 100"""
    def _compute():
        qs = Transaction.objects.filter(project_id=project_id, timestamp__gte=since)
        if service_name:
            qs = qs.filter(service_name=service_name)
        total = qs.count()
        if total == 0:
            return None
        errors = qs.filter(error=True).count()
        return (errors / total) * 100.0

    return await sync_to_async(_compute)()


async def get_avg_response_time(project_id, service_name, since):
    """Derive average response time from transactions"""
    def _compute():
        qs = Transaction.objects.filter(project_id=project_id, timestamp__gte=since)
        if service_name:
            qs = qs.filter(service_name=service_name)
        result = qs.aggregate(avg_val=Avg("duration_ms"))
        return result["avg_val"]

    return await sync_to_async(_compute)()


async def get_host_metric(project_id, field_name, since):
    """Get average host metric (cpu_percent, memory_percent) across hosts"""
    def _compute():
        qs = HostMetric.objects.filter(
            project_id=project_id,
            timestamp__gte=since,
        )
        result = qs.aggregate(avg_val=Avg(field_name))
        return result["avg_val"]

    return await sync_to_async(_compute)()


def check_threshold(value, operator, threshold):
    """Check if value satisfies the threshold condition"""
    if operator == ">":
        return value > threshold
    if operator == "<":
        return value < threshold
    if operator == ">=":
        return value >= threshold
    if operator == "<=":
        return value <= threshold
    if operator == "==":
        return value == threshold
    if operator == "!=":
        return value != threshold
    logger.warning("Unknown operator %s, defaulting to >", operator)
    return value > threshold
