"""
In-memory storage for metrics-collector-service.
All API modules import from here. Demo data is populated on startup when empty.
"""
from typing import Any

# Metrics & transactions
metrics_data_points: list[dict[str, Any]] = []
transactions: list[dict[str, Any]] = []

# Traces & spans (traces is list of {trace_id, spans})
traces: list[dict[str, Any]] = []
spans_by_trace: dict[str, list[dict[str, Any]]] = {}

# Errors (grouped by fingerprint)
error_groups: dict[str, dict[str, Any]] = {}

# Infrastructure
hosts: dict[str, dict[str, Any]] = {}

# Deployments
deployments: list[dict[str, Any]] = []

# SLOs
slos: dict[str, dict[str, Any]] = {}

# Synthetic monitors
monitors: dict[str, dict[str, Any]] = {}
