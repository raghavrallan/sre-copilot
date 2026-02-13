"""In-memory storage for alerting-service."""
from typing import Any, Dict, List

# Alert conditions
alert_conditions: List[Dict[str, Any]] = []

# Alert policies
alert_policies: List[Dict[str, Any]] = []

# Notification channels
notification_channels: List[Dict[str, Any]] = []

# Muting rules
muting_rules: List[Dict[str, Any]] = []

# Active alerts (for demo)
active_alerts: List[Dict[str, Any]] = []
