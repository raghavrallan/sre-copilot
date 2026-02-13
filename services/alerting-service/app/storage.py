"""Django ORM-backed storage for alerting-service."""
from datetime import datetime
from typing import Any, Dict, List, Optional

from django.utils import timezone

from shared.models import AlertCondition, AlertPolicy, NotificationChannel, ActiveAlert, MutingRule, Project


# Operator mapping: API format -> Django model format
OPERATOR_MAP = {"gt": ">", "lt": "<", "eq": "==", "gte": ">=", "lte": "<="}
OPERATOR_REVERSE = {v: k for k, v in OPERATOR_MAP.items()}


async def _get_project(project_id: str) -> Project:
    """Get project by ID, raises if not found."""
    project = await Project.objects.filter(id=project_id).afirst()
    if not project:
        raise ValueError("Project not found")
    return project


def _condition_to_dict(obj: AlertCondition) -> Dict[str, Any]:
    """Convert AlertCondition model to API response shape."""
    return {
        "condition_id": str(obj.id),
        "name": obj.name,
        "metric_name": obj.metric_name,
        "operator": OPERATOR_REVERSE.get(obj.operator, obj.operator),
        "threshold": obj.threshold,
        "duration_seconds": obj.duration_minutes * 60,
        "severity": obj.severity,
        "service_name": obj.service_name or "",
        "enabled": obj.is_enabled,
        "created_at": obj.created_at.isoformat() + "Z" if obj.created_at else "",
    }


async def create_condition(project_id: str, tenant_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create an alert condition."""
    operator = OPERATOR_MAP.get(data.get("operator", "gt"), ">")
    duration_seconds = data.get("duration_seconds", 300)
    duration_minutes = max(1, duration_seconds // 60)

    obj = await AlertCondition.objects.acreate(
        project_id=project_id,
        tenant_id=tenant_id,
        name=data["name"],
        metric_name=data["metric_name"],
        condition_type="threshold",
        service_name=data.get("service_name", ""),
        operator=operator,
        threshold=data["threshold"],
        duration_minutes=duration_minutes,
        severity=data.get("severity", "warning"),
        is_enabled=data.get("enabled", True),
    )
    return _condition_to_dict(obj)


async def list_conditions(
    project_id: str,
    service_name: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> List[Dict[str, Any]]:
    """List alert conditions for a project."""
    qs = AlertCondition.objects.filter(project_id=project_id)
    if service_name:
        qs = qs.filter(service_name=service_name)
    if enabled is not None:
        qs = qs.filter(is_enabled=enabled)
    qs = qs.order_by("-created_at")

    result = []
    async for obj in qs:
        result.append(_condition_to_dict(obj))
    return result


async def get_condition(project_id: str, condition_id: str) -> Optional[Dict[str, Any]]:
    """Get a single alert condition by ID."""
    obj = await AlertCondition.objects.filter(
        project_id=project_id, id=condition_id
    ).afirst()
    return _condition_to_dict(obj) if obj else None


async def update_condition(
    project_id: str, condition_id: str, data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update an alert condition."""
    obj = await AlertCondition.objects.filter(
        project_id=project_id, id=condition_id
    ).afirst()
    if not obj:
        return None

    update_fields = []
    if "name" in data:
        obj.name = data["name"]
        update_fields.append("name")
    if "metric_name" in data:
        obj.metric_name = data["metric_name"]
        update_fields.append("metric_name")
    if "operator" in data:
        obj.operator = OPERATOR_MAP.get(data["operator"], data["operator"])
        update_fields.append("operator")
    if "threshold" in data:
        obj.threshold = data["threshold"]
        update_fields.append("threshold")
    if "duration_seconds" in data:
        obj.duration_minutes = max(1, data["duration_seconds"] // 60)
        update_fields.append("duration_minutes")
    if "severity" in data:
        obj.severity = data["severity"]
        update_fields.append("severity")
    if "service_name" in data:
        obj.service_name = data["service_name"]
        update_fields.append("service_name")
    if "enabled" in data:
        obj.is_enabled = data["enabled"]
        update_fields.append("is_enabled")

    if update_fields:
        await obj.asave(update_fields=update_fields)
    return _condition_to_dict(obj)


async def delete_condition(project_id: str, condition_id: str) -> bool:
    """Delete an alert condition."""
    deleted, _ = await AlertCondition.objects.filter(
        project_id=project_id, id=condition_id
    ).adelete()
    return deleted > 0


def _policy_to_dict(obj: AlertPolicy, condition_ids: Optional[List[str]] = None) -> Dict[str, Any]:
    """Convert AlertPolicy model to API response shape."""
    return {
        "policy_id": str(obj.id),
        "name": obj.name,
        "description": obj.description or "",
        "condition_ids": condition_ids or [],
        "incident_preference": "per_condition",
        "enabled": obj.is_enabled,
        "created_at": obj.created_at.isoformat() + "Z" if obj.created_at else "",
    }


async def create_policy(project_id: str, tenant_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create an alert policy."""
    obj = await AlertPolicy.objects.acreate(
        project_id=project_id,
        tenant_id=tenant_id,
        name=data["name"],
        description=data.get("description", ""),
        is_enabled=data.get("enabled", True),
    )
    return _policy_to_dict(obj, data.get("condition_ids", []))


async def list_policies(project_id: str, enabled: Optional[bool] = None) -> List[Dict[str, Any]]:
    """List alert policies for a project."""
    qs = AlertPolicy.objects.filter(project_id=project_id)
    if enabled is not None:
        qs = qs.filter(is_enabled=enabled)
    qs = qs.order_by("-created_at")

    result = []
    async for obj in qs:
        condition_ids = []
        async for c in obj.conditions.all():
            condition_ids.append(str(c.id))
        result.append(_policy_to_dict(obj, condition_ids))
    return result


async def get_policy(project_id: str, policy_id: str) -> Optional[Dict[str, Any]]:
    """Get a single alert policy by ID."""
    obj = await AlertPolicy.objects.filter(
        project_id=project_id, id=policy_id
    ).afirst()
    if not obj:
        return None
    condition_ids = []
    async for c in obj.conditions.all():
        condition_ids.append(str(c.id))
    return _policy_to_dict(obj, condition_ids)


async def update_policy(
    project_id: str, policy_id: str, data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update an alert policy."""
    obj = await AlertPolicy.objects.filter(
        project_id=project_id, id=policy_id
    ).afirst()
    if not obj:
        return None

    update_fields = []
    if "name" in data:
        obj.name = data["name"]
        update_fields.append("name")
    if "description" in data:
        obj.description = data["description"]
        update_fields.append("description")
    if "enabled" in data:
        obj.is_enabled = data["enabled"]
        update_fields.append("is_enabled")

    if update_fields:
        await obj.asave(update_fields=update_fields)

    condition_ids = []
    async for c in obj.conditions.all():
        condition_ids.append(str(c.id))
    return _policy_to_dict(obj, condition_ids)


async def delete_policy(project_id: str, policy_id: str) -> bool:
    """Delete an alert policy."""
    deleted, _ = await AlertPolicy.objects.filter(
        project_id=project_id, id=policy_id
    ).adelete()
    return deleted > 0


def _channel_to_dict(obj: NotificationChannel) -> Dict[str, Any]:
    """Convert NotificationChannel model to API response shape."""
    channel_type = obj.channel_type
    if channel_type == "teams":
        channel_type = "msteams"  # API uses msteams
    return {
        "channel_id": str(obj.id),
        "name": obj.name,
        "type": channel_type,
        "config": obj.config or {},
        "enabled": obj.is_enabled,
        "created_at": obj.created_at.isoformat() + "Z" if obj.created_at else "",
    }


async def create_channel(project_id: str, tenant_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a notification channel."""
    channel_type = data.get("type", "webhook")
    if channel_type == "msteams":
        channel_type = "teams"  # Django model uses "teams"
    obj = await NotificationChannel.objects.acreate(
        project_id=project_id,
        tenant_id=tenant_id,
        name=data["name"],
        channel_type=channel_type,
        config=data.get("config", {}),
        is_enabled=data.get("enabled", True),
    )
    return _channel_to_dict(obj)


async def list_channels(project_id: str) -> List[Dict[str, Any]]:
    """List notification channels for a project."""
    result = []
    async for obj in NotificationChannel.objects.filter(
        project_id=project_id
    ).order_by("-created_at"):
        result.append(_channel_to_dict(obj))
    return result


async def get_channel(project_id: str, channel_id: str) -> Optional[Dict[str, Any]]:
    """Get a single notification channel by ID."""
    obj = await NotificationChannel.objects.filter(
        project_id=project_id, id=channel_id
    ).afirst()
    return _channel_to_dict(obj) if obj else None


async def update_channel(
    project_id: str, channel_id: str, data: Dict[str, Any]
) -> Optional[Dict[str, Any]]:
    """Update a notification channel."""
    obj = await NotificationChannel.objects.filter(
        project_id=project_id, id=channel_id
    ).afirst()
    if not obj:
        return None

    update_fields = []
    if "name" in data:
        obj.name = data["name"]
        update_fields.append("name")
    if "type" in data:
        obj.channel_type = "teams" if data["type"] == "msteams" else data["type"]
        update_fields.append("channel_type")
    if "config" in data:
        obj.config = data["config"]
        update_fields.append("config")
    if "enabled" in data:
        obj.is_enabled = data["enabled"]
        update_fields.append("is_enabled")

    if update_fields:
        await obj.asave(update_fields=update_fields)
    return _channel_to_dict(obj)


async def delete_channel(project_id: str, channel_id: str) -> bool:
    """Delete a notification channel."""
    deleted, _ = await NotificationChannel.objects.filter(
        project_id=project_id, id=channel_id
    ).adelete()
    return deleted > 0


def _muting_rule_to_dict(obj: MutingRule) -> Dict[str, Any]:
    """Convert MutingRule model to API response shape."""
    return {
        "rule_id": str(obj.id),
        "name": obj.name,
        "description": obj.description or "",
        "condition_ids": [],
        "match_criteria": obj.matchers or {},
        "start_time": obj.starts_at.isoformat() + "Z" if obj.starts_at else "",
        "end_time": obj.ends_at.isoformat() + "Z" if obj.ends_at else "",
        "repeat": "none",
        "enabled": obj.is_active,
        "created_at": obj.created_at.isoformat() + "Z" if obj.created_at else "",
    }


async def create_muting_rule(
    project_id: str, tenant_id: str, data: Dict[str, Any]
) -> Dict[str, Any]:
    """Create a muting rule."""
    now = timezone.now()
    start_str = data.get("start_time") or ""
    end_str = data.get("end_time") or ""
    if not start_str:
        start_time = now
    else:
        start_time = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
    if not end_str:
        end_time = now
    else:
        end_time = datetime.fromisoformat(end_str.replace("Z", "+00:00"))

    obj = await MutingRule.objects.acreate(
        project_id=project_id,
        tenant_id=tenant_id,
        name=data["name"],
        description=data.get("description", ""),
        matchers=data.get("match_criteria", data.get("matchers", {})),
        starts_at=start_time,
        ends_at=end_time,
        is_active=data.get("enabled", True),
        created_by=data.get("created_by", ""),
    )
    return _muting_rule_to_dict(obj)


async def list_muting_rules(project_id: str) -> List[Dict[str, Any]]:
    """List muting rules for a project."""
    result = []
    async for obj in MutingRule.objects.filter(
        project_id=project_id
    ).order_by("-created_at"):
        result.append(_muting_rule_to_dict(obj))
    return result


async def delete_muting_rule(project_id: str, rule_id: str) -> bool:
    """Delete a muting rule."""
    deleted, _ = await MutingRule.objects.filter(
        project_id=project_id, id=rule_id
    ).adelete()
    return deleted > 0


def _active_alert_to_dict(obj: ActiveAlert, condition_name: str = "") -> Dict[str, Any]:
    """Convert ActiveAlert model to API response shape."""
    return {
        "alert_id": str(obj.id),
        "condition_id": str(obj.condition_id) if obj.condition_id else "",
        "condition_name": condition_name,
        "fired_at": obj.fired_at.isoformat() + "Z" if obj.fired_at else "",
        "severity": obj.severity,
        "message": obj.description or obj.title,
        "current_value": obj.metric_value,
        "threshold": None,
        "status": obj.status,
        "acknowledged": obj.acknowledged_at is not None,
        "service_name": obj.service_name or "",
    }


async def list_active_alerts(project_id: str) -> List[Dict[str, Any]]:
    """List active alerts for a project."""
    result = []
    async for obj in ActiveAlert.objects.filter(
        project_id=project_id
    ).select_related("condition").order_by("-fired_at"):
        cond_name = obj.condition.name if obj.condition else "Unknown"
        result.append(_active_alert_to_dict(obj, cond_name))
    return result
