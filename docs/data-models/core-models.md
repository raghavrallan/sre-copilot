# Core Data Models
## SRE Copilot Database Schema

**ORM:** Django ORM
**Database:** PostgreSQL 15+
**Migration Tool:** Django Migrations

---

## Overview

This document defines all Django models for the SRE Copilot platform. Models are organized by domain.

---

## 1. Tenant & User Management

### Tenant

The top-level entity for multi-tenancy. All data is scoped to a tenant.

```python
# models/tenant.py
from django.db import models
import uuid

class Tenant(models.Model):
    """
    Multi-tenant root entity
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, help_text="Company/team name")
    slug = models.SlugField(unique=True, max_length=100, help_text="URL-safe identifier")

    # Subscription
    plan_type = models.CharField(
        max_length=50,
        choices=[
            ('starter', 'Starter'),
            ('professional', 'Professional'),
            ('enterprise', 'Enterprise')
        ],
        default='starter'
    )
    max_services = models.IntegerField(default=5, help_text="Service limit based on plan")
    max_incidents_per_month = models.IntegerField(default=100)

    # Contact
    contact_email = models.EmailField()
    contact_name = models.CharField(max_length=255, null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    trial_ends_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tenants'
        indexes = [
            models.Index(fields=['slug']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"
```

### User

User accounts within a tenant.

```python
# models/user.py
class User(models.Model):
    """
    User account (scoped to tenant)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(
        'Tenant',
        on_delete=models.CASCADE,
        related_name='users'
    )

    # Authentication
    email = models.EmailField(unique=True)
    azure_ad_id = models.CharField(max_length=255, unique=True, null=True, blank=True)

    # Profile
    full_name = models.CharField(max_length=255)
    avatar_url = models.URLField(null=True, blank=True)

    # Authorization
    role = models.CharField(
        max_length=50,
        choices=[
            ('admin', 'Admin'),
            ('engineer', 'Engineer'),
            ('viewer', 'Viewer')
        ],
        default='engineer'
    )

    # Slack integration
    slack_user_id = models.CharField(max_length=50, null=True, blank=True)
    slack_email = models.EmailField(null=True, blank=True)

    # Preferences
    preferences = models.JSONField(default=dict, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['tenant', 'role']),
            models.Index(fields=['email']),
            models.Index(fields=['slack_user_id']),
        ]
        unique_together = [['tenant', 'email']]

    def __str__(self):
        return f"{self.full_name} ({self.email})"
```

---

## 2. Incidents & Signals

### Incident

Core incident entity tracking production issues.

```python
# models/incident.py
class IncidentState(models.TextChoices):
    DETECTED = 'detected', 'Detected'
    ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
    INVESTIGATING = 'investigating', 'Investigating'
    MITIGATED = 'mitigated', 'Mitigated'
    RESOLVED = 'resolved', 'Resolved'
    LEARNED = 'learned', 'Learned'
    INCONCLUSIVE = 'inconclusive', 'Inconclusive'

class IncidentSeverity(models.TextChoices):
    CRITICAL = 'critical', 'Critical'
    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'
    INFO = 'info', 'Info'

class Incident(models.Model):
    """
    Production incident
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='incidents')

    # Identification
    external_id = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        help_text="External ID from PagerDuty, Datadog, etc."
    )
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)

    # Service
    service_name = models.CharField(max_length=255, db_index=True)
    service_environment = models.CharField(
        max_length=50,
        choices=[
            ('production', 'Production'),
            ('staging', 'Staging'),
            ('development', 'Development')
        ],
        default='production'
    )

    # State
    state = models.CharField(
        max_length=50,
        choices=IncidentState.choices,
        default=IncidentState.DETECTED,
        db_index=True
    )
    severity = models.CharField(
        max_length=50,
        choices=IncidentSeverity.choices,
        default=IncidentSeverity.MEDIUM
    )

    # Timing (for MTTR calculations)
    detected_at = models.DateTimeField(db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    investigating_started_at = models.DateTimeField(null=True, blank=True)
    mitigated_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Ownership
    assigned_to = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_incidents'
    )

    # Impact
    user_impact_description = models.TextField(blank=True)
    affected_user_count = models.IntegerField(null=True, blank=True)
    slo_breached = models.BooleanField(default=False)

    # Context snapshot (immutable)
    context_snapshot = models.JSONField(null=True, blank=True)
    context_snapshot_id = models.UUIDField(null=True, blank=True, unique=True)

    # Slack integration
    slack_thread_ts = models.CharField(max_length=50, null=True, blank=True, unique=True)
    slack_channel_id = models.CharField(max_length=50, null=True, blank=True)

    # Root cause (filled after investigation)
    root_cause = models.TextField(blank=True)
    resolution_summary = models.TextField(blank=True)

    # Post-mortem
    postmortem_url = models.URLField(null=True, blank=True)

    # Metadata
    tags = models.JSONField(default=list, blank=True)
    metadata = models.JSONField(default=dict, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incidents'
        indexes = [
            models.Index(fields=['tenant', 'state']),
            models.Index(fields=['tenant', 'detected_at']),
            models.Index(fields=['tenant', 'service_name']),
            models.Index(fields=['severity', 'state']),
            models.Index(fields=['detected_at']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title}"

    @property
    def mttr_seconds(self):
        """Mean Time To Resolution in seconds"""
        if self.resolved_at and self.detected_at:
            return (self.resolved_at - self.detected_at).total_seconds()
        return None

    @property
    def mtta_seconds(self):
        """Mean Time To Acknowledge in seconds"""
        if self.acknowledged_at and self.detected_at:
            return (self.acknowledged_at - self.detected_at).total_seconds()
        return None
```

### Signal

Raw observability signals (alerts, metrics, logs, events).

```python
# models/signal.py
class SignalType(models.TextChoices):
    ALERT = 'alert', 'Alert'
    METRIC_DEVIATION = 'metric_deviation', 'Metric Deviation'
    LOG_PATTERN = 'log_pattern', 'Log Pattern'
    DEPLOY_EVENT = 'deploy_event', 'Deploy Event'
    CONFIG_CHANGE = 'config_change', 'Config Change'
    TRACE_ANOMALY = 'trace_anomaly', 'Trace Anomaly'

class Signal(models.Model):
    """
    Observability signal (alert, metric, log, event)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='signals')
    incident = models.ForeignKey(
        'Incident',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='signals'
    )

    # Classification
    signal_type = models.CharField(max_length=50, choices=SignalType.choices)
    source = models.CharField(max_length=100, help_text="prometheus, pagerduty, datadog, etc.")
    severity = models.CharField(max_length=50)

    # Content
    raw_data = models.JSONField(help_text="Original signal data")
    normalized_data = models.JSONField(help_text="Normalized signal data")

    # Service context
    service_name = models.CharField(max_length=255, null=True, blank=True, db_index=True)
    service_environment = models.CharField(max_length=50, null=True, blank=True)

    # Context
    context_snapshot_id = models.UUIDField(null=True, blank=True)

    # Deduplication
    fingerprint = models.CharField(
        max_length=64,
        db_index=True,
        help_text="Hash for deduplication"
    )
    is_duplicate = models.BooleanField(default=False)
    original_signal = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='duplicates'
    )

    # Processing
    processed = models.BooleanField(default=False, db_index=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    processing_error = models.TextField(null=True, blank=True)

    # Timing
    timestamp = models.DateTimeField(db_index=True, help_text="Signal occurrence time")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'signals'
        indexes = [
            models.Index(fields=['tenant', 'timestamp']),
            models.Index(fields=['tenant', 'processed']),
            models.Index(fields=['fingerprint', 'timestamp']),
            models.Index(fields=['incident']),
            models.Index(fields=['service_name', 'timestamp']),
        ]

    def __str__(self):
        return f"[{self.signal_type}] {self.service_name} at {self.timestamp}"
```

### IncidentStateTransition

Audit log of incident state changes.

```python
# models/incident_state_transition.py
class IncidentStateTransition(models.Model):
    """
    Incident state transition log (immutable)
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        'Incident',
        on_delete=models.CASCADE,
        related_name='state_transitions'
    )

    # Transition
    from_state = models.CharField(max_length=50)
    to_state = models.CharField(max_length=50)

    # Context
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    reason = models.TextField(blank=True)
    automated = models.BooleanField(default=False, help_text="Was this an automated transition?")

    # Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'incident_state_transitions'
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['incident', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.from_state} → {self.to_state} at {self.timestamp}"
```

---

## 3. Hypotheses & Evidence

### Hypothesis

AI-generated root cause hypothesis.

```python
# models/hypothesis.py
class Hypothesis(models.Model):
    """
    Root cause hypothesis
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey('Incident', on_delete=models.CASCADE, related_name='hypotheses')

    # Claim
    claim = models.TextField(help_text="Hypothesis claim (1-2 sentences)")
    description = models.TextField(blank=True, help_text="Detailed explanation")

    # Confidence (multi-factor score)
    confidence_lower = models.FloatField(help_text="Lower bound of confidence interval")
    confidence_upper = models.FloatField(help_text="Upper bound of confidence interval")
    confidence_primary = models.FloatField(db_index=True, help_text="Primary confidence score")

    # Confidence components (for explainability)
    confidence_components = models.JSONField(
        default=dict,
        help_text="Breakdown: signal_strength, temporal_correlation, etc."
    )

    # Evidence
    supporting_evidence = models.JSONField(default=list, help_text="List of evidence dicts")
    contradicting_evidence = models.JSONField(default=list, help_text="Contradicting evidence")

    # Historical context
    similar_incidents = models.JSONField(default=list, help_text="List of similar incident IDs")
    precedent_count = models.IntegerField(default=0)

    # Ranking
    rank = models.IntegerField(help_text="Rank among hypotheses for this incident")

    # User feedback
    user_feedback = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        choices=[
            ('accepted', 'Accepted'),
            ('rejected', 'Rejected'),
            ('uncertain', 'Uncertain'),
        ]
    )
    feedback_timestamp = models.DateTimeField(null=True, blank=True)
    feedback_user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)
    feedback_notes = models.TextField(blank=True)

    # AI generation
    llm_model = models.CharField(max_length=100, default='claude-sonnet-4-5')
    llm_prompt_tokens = models.IntegerField(null=True, blank=True)
    llm_completion_tokens = models.IntegerField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'hypotheses'
        ordering = ['rank']
        indexes = [
            models.Index(fields=['incident', 'rank']),
            models.Index(fields=['incident', 'confidence_primary']),
            models.Index(fields=['user_feedback']),
        ]

    def __str__(self):
        return f"#{self.rank}: {self.claim[:50]}... ({self.confidence_primary:.2f})"
```

---

## 4. Runbooks & Recommendations

### Runbook

Operational runbook/playbook.

```python
# models/runbook.py
class Runbook(models.Model):
    """
    Operational runbook/playbook
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='runbooks')

    # Identification
    title = models.CharField(max_length=500)
    slug = models.SlugField(max_length=200)
    description = models.TextField()

    # Content
    content = models.TextField(help_text="Markdown content")
    content_url = models.URLField(null=True, blank=True, help_text="External URL (Confluence, etc.)")

    # Metadata
    service_names = models.JSONField(default=list, help_text="Applicable services")
    tags = models.JSONField(default=list)

    # Risk & time estimation
    risk_level = models.CharField(
        max_length=50,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
            ('critical', 'Critical')
        ],
        default='medium'
    )
    estimated_duration_minutes = models.IntegerField(null=True, blank=True)

    # Usage tracking
    usage_count = models.IntegerField(default=0)
    success_count = models.IntegerField(default=0)
    failure_count = models.IntegerField(default=0)

    # Vector embedding (for semantic search)
    embedding_vector_id = models.CharField(max_length=255, null=True, blank=True, unique=True)

    # Ownership
    owner = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)

    # Status
    is_active = models.BooleanField(default=True)
    version = models.IntegerField(default=1)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'runbooks'
        unique_together = [['tenant', 'slug']]
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['risk_level']),
        ]

    def __str__(self):
        return self.title

    @property
    def success_rate(self):
        total = self.usage_count
        if total == 0:
            return None
        return self.success_count / total
```

### Recommendation

AI-generated recommendation for incident resolution.

```python
# models/recommendation.py
class Recommendation(models.Model):
    """
    AI-generated recommendation
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey('Incident', on_delete=models.CASCADE, related_name='recommendations')
    hypothesis = models.ForeignKey(
        'Hypothesis',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='recommendations'
    )
    runbook = models.ForeignKey(
        'Runbook',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recommendations'
    )

    # Recommendation
    action_type = models.CharField(max_length=100, help_text="restart, scale, rollback, etc.")
    description = models.TextField()
    rationale = models.TextField()

    # Risk assessment
    risk_level = models.CharField(max_length=50)
    estimated_impact = models.TextField()
    reversibility = models.CharField(
        max_length=50,
        choices=[
            ('instant', 'Instantly Reversible'),
            ('manual', 'Manually Reversible'),
            ('difficult', 'Difficult to Reverse'),
            ('irreversible', 'Irreversible')
        ]
    )

    # Ranking
    relevance_score = models.FloatField(help_text="Semantic similarity score")
    rank = models.IntegerField()

    # User interaction
    status = models.CharField(
        max_length=50,
        choices=[
            ('pending', 'Pending'),
            ('accepted', 'Accepted'),
            ('rejected', 'Rejected'),
            ('executed', 'Executed')
        ],
        default='pending'
    )
    user_notes = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    status_updated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'recommendations'
        ordering = ['rank']
        indexes = [
            models.Index(fields=['incident', 'rank']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.action_type}: {self.description[:50]}..."
```

---

## 5. Integrations

### Integration

External tool integration configuration.

```python
# models/integration.py
class IntegrationType(models.TextChoices):
    PROMETHEUS = 'prometheus', 'Prometheus'
    PAGERDUTY = 'pagerduty', 'PagerDuty'
    DATADOG = 'datadog', 'Datadog'
    GRAFANA = 'grafana', 'Grafana'
    SLACK = 'slack', 'Slack'
    # ... more types

class Integration(models.Model):
    """
    External tool integration
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='integrations')

    # Type
    integration_type = models.CharField(max_length=50, choices=IntegrationType.choices)
    name = models.CharField(max_length=255, help_text="User-friendly name")

    # Configuration (encrypted at application layer)
    config = models.JSONField(help_text="Integration-specific config (URLs, credentials, etc.)")

    # Health monitoring
    is_healthy = models.BooleanField(default=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_sync_status = models.CharField(max_length=50, null=True, blank=True)
    last_error = models.TextField(null=True, blank=True)
    consecutive_failures = models.IntegerField(default=0)

    # Sync settings
    sync_interval_seconds = models.IntegerField(default=30, help_text="For pull-based integrations")
    enabled_features = models.JSONField(default=list, help_text="Which features are enabled")

    # Status
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'integrations'
        indexes = [
            models.Index(fields=['tenant', 'integration_type']),
            models.Index(fields=['is_healthy']),
        ]

    def __str__(self):
        return f"{self.name} ({self.integration_type})"
```

---

## 6. Audit & Compliance

### AuditLog

Immutable audit trail.

```python
# models/audit_log.py
class AuditLog(models.Model):
    """
    Immutable audit log
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='audit_logs')
    user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True, blank=True)

    # Event classification
    event_type = models.CharField(max_length=100, db_index=True)
    resource_type = models.CharField(max_length=100, null=True, blank=True)
    resource_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(
        max_length=50,
        choices=[
            ('create', 'Create'),
            ('read', 'Read'),
            ('update', 'Update'),
            ('delete', 'Delete'),
            ('execute', 'Execute')
        ]
    )

    # Request context
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, null=True, blank=True)
    request_method = models.CharField(max_length=10, null=True, blank=True)
    request_path = models.CharField(max_length=500, null=True, blank=True)

    # Details
    details = models.JSONField(default=dict, blank=True)
    result = models.CharField(max_length=50, null=True, blank=True)  # success, failure, error

    # Timestamp
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'audit_logs'
        indexes = [
            models.Index(fields=['tenant', 'timestamp']),
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['event_type', 'timestamp']),
            models.Index(fields=['resource_type', 'resource_id']),
        ]

    def __str__(self):
        return f"[{self.event_type}] {self.action} by {self.user} at {self.timestamp}"
```

---

## Relationships Diagram

```
Tenant (1) ─┬─ (*) User
            ├─ (*) Incident ─┬─ (*) Signal
            │                ├─ (*) Hypothesis ─── (*) Recommendation
            │                ├─ (*) IncidentStateTransition
            │                └─ (*) Recommendation
            ├─ (*) Signal
            ├─ (*) Runbook
            ├─ (*) Integration
            └─ (*) AuditLog

User (1) ─── (*) Incident (assigned)
        └─── (*) Hypothesis (feedback)
```

---

## Indexes Strategy

### High-Traffic Queries
- `tenant` + `timestamp` (for time-range queries)
- `incident` + `timestamp` (for incident timelines)
- `tenant` + `state` (for active incidents)
- `service_name` + `timestamp` (for service-specific queries)
- `fingerprint` + `timestamp` (for deduplication)

### Unique Constraints
- `tenants.slug`
- `users.email`
- `users.[tenant, email]`
- `incidents.slack_thread_ts`
- `signals.context_snapshot_id`
- `runbooks.[tenant, slug]`

---

## Data Retention Policy

| Model | Retention | Archive Strategy |
|-------|-----------|------------------|
| Incident | 3 years | Move to cold storage after 1 year |
| Signal | 1 year | Delete after 1 year |
| Hypothesis | 3 years | Keep with incident |
| AuditLog | 3 years | Immutable, compress after 6 months |
| Runbook | Indefinite | Soft delete only |

---

## Migration Strategy

1. **Initial migration**: Create all tables
2. **Seed data**: Load default runbooks, sample data
3. **Zero-downtime migrations**: Use Django migrations with backwards compatibility
4. **Data backups**: Daily automated backups to Azure Blob Storage

---

## Next Steps

1. Generate Django migrations: `python manage.py makemigrations`
2. Apply migrations: `python manage.py migrate`
3. Create seed data script
4. Write model tests
