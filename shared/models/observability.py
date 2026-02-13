"""
Observability data models - all telemetry data scoped by project/tenant.
Replaces in-memory storage in metrics-collector, log-service, alerting-service,
security-service, synthetic-service.
"""
import uuid
from django.db import models


# ---- APM / Metrics ----

class MetricDataPoint(models.Model):
    """Raw metric data points ingested from user's SDKs"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='metric_data_points')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    service_name = models.CharField(max_length=255)
    metric_name = models.CharField(max_length=255)
    value = models.FloatField()
    metric_type = models.CharField(max_length=20, default='gauge')  # gauge, counter, histogram
    tags = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_metric_data_points'
        indexes = [
            models.Index(fields=['project', 'service_name', 'metric_name', 'timestamp']),
            models.Index(fields=['project', 'timestamp']),
        ]
        ordering = ['-timestamp']


class Transaction(models.Model):
    """HTTP transaction data from user's instrumented services"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='transactions')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    transaction_id = models.CharField(max_length=128, db_index=True)
    service_name = models.CharField(max_length=255, db_index=True)
    endpoint = models.CharField(max_length=500)
    method = models.CharField(max_length=10)
    status_code = models.IntegerField()
    duration_ms = models.FloatField()
    db_duration_ms = models.FloatField(default=0)
    external_duration_ms = models.FloatField(default=0)
    error = models.BooleanField(default=False)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_transactions'
        indexes = [
            models.Index(fields=['project', 'service_name', 'timestamp']),
            models.Index(fields=['project', 'service_name', 'endpoint']),
        ]
        ordering = ['-timestamp']


# ---- Distributed Tracing ----

class Trace(models.Model):
    """A distributed trace (group of spans)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='traces')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    trace_id = models.CharField(max_length=128, db_index=True)
    root_service = models.CharField(max_length=255, blank=True, default='')
    root_operation = models.CharField(max_length=500, blank=True, default='')
    duration_ms = models.FloatField(default=0)
    span_count = models.IntegerField(default=0)
    has_error = models.BooleanField(default=False)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_traces'
        indexes = [
            models.Index(fields=['project', 'trace_id']),
            models.Index(fields=['project', 'timestamp']),
        ]
        ordering = ['-timestamp']
        unique_together = [('project', 'trace_id')]


class Span(models.Model):
    """Individual span within a trace"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='spans')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)
    trace = models.ForeignKey(Trace, on_delete=models.CASCADE, related_name='spans', null=True, blank=True, db_column='trace_fk_id')

    trace_id = models.CharField(max_length=128, db_index=True)
    span_id = models.CharField(max_length=128, db_index=True)
    parent_span_id = models.CharField(max_length=128, blank=True, default='')
    service_name = models.CharField(max_length=255)
    operation = models.CharField(max_length=500)
    duration_ms = models.FloatField()
    status = models.CharField(max_length=20, default='ok')  # ok, error
    attributes = models.JSONField(default=dict, blank=True)
    events = models.JSONField(default=list, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_spans'
        indexes = [
            models.Index(fields=['project', 'trace_id']),
            models.Index(fields=['project', 'service_name', 'timestamp']),
        ]
        ordering = ['-timestamp']


# ---- Error Tracking ----

class ErrorGroup(models.Model):
    """Aggregated error group (unique error class + message fingerprint)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='error_groups')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    fingerprint = models.CharField(max_length=128, db_index=True)
    service_name = models.CharField(max_length=255)
    error_class = models.CharField(max_length=500)
    message = models.TextField()
    occurrence_count = models.IntegerField(default=1)
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)
    status = models.CharField(max_length=20, default='unresolved')  # unresolved, resolved, ignored
    assignee = models.CharField(max_length=255, blank=True, default='')

    class Meta:
        app_label = 'shared'
        db_table = 'obs_error_groups'
        indexes = [
            models.Index(fields=['project', 'service_name']),
            models.Index(fields=['project', 'fingerprint']),
            models.Index(fields=['project', 'status']),
        ]
        unique_together = [('project', 'fingerprint')]
        ordering = ['-last_seen']


class ErrorOccurrence(models.Model):
    """Individual error occurrence linked to an error group"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE)
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)
    error_group = models.ForeignKey(ErrorGroup, on_delete=models.CASCADE, related_name='occurrences')

    stack_trace = models.TextField(blank=True, default='')
    attributes = models.JSONField(default=dict, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_error_occurrences'
        indexes = [
            models.Index(fields=['error_group', 'timestamp']),
        ]
        ordering = ['-timestamp']


# ---- Infrastructure Monitoring ----

class HostMetric(models.Model):
    """Infrastructure host metrics from user's infra agent"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='host_metrics')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    hostname = models.CharField(max_length=255, db_index=True)
    cpu_percent = models.FloatField(default=0)
    memory_percent = models.FloatField(default=0)
    disk_usage = models.JSONField(default=dict, blank=True)
    network_io = models.JSONField(default=dict, blank=True)
    load_avg = models.JSONField(default=list, blank=True)
    processes = models.JSONField(default=list, blank=True)
    containers = models.JSONField(default=list, blank=True)
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_host_metrics'
        indexes = [
            models.Index(fields=['project', 'hostname', 'timestamp']),
        ]
        ordering = ['-timestamp']


# ---- Log Management ----

class LogEntry(models.Model):
    """Log entries from user's applications"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='log_entries')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    timestamp = models.DateTimeField(db_index=True)
    level = models.CharField(max_length=20, db_index=True)  # DEBUG, INFO, WARN, ERROR, FATAL
    service_name = models.CharField(max_length=255, db_index=True)
    message = models.TextField()
    attributes = models.JSONField(default=dict, blank=True)
    trace_id = models.CharField(max_length=128, blank=True, default='')
    span_id = models.CharField(max_length=128, blank=True, default='')

    class Meta:
        app_label = 'shared'
        db_table = 'obs_log_entries'
        indexes = [
            models.Index(fields=['project', 'service_name', 'timestamp']),
            models.Index(fields=['project', 'level', 'timestamp']),
            models.Index(fields=['project', 'trace_id']),
        ]
        ordering = ['-timestamp']


# ---- Deployments / Change Tracking ----

class Deployment(models.Model):
    """Deployment records from user's CI/CD pipelines"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='deployments')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    deployment_id = models.CharField(max_length=128, blank=True, default='')
    service = models.CharField(max_length=255)
    version = models.CharField(max_length=128)
    environment = models.CharField(max_length=50, default='production')
    commit_sha = models.CharField(max_length=64, blank=True, default='')
    commit_message = models.TextField(blank=True, default='')
    description = models.TextField(blank=True, default='')
    deployed_by = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, default='success')  # success, failed, in_progress, rolled_back
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    source = models.CharField(max_length=50, default='manual')  # manual, github, azure_devops, gitlab, webhook

    class Meta:
        app_label = 'shared'
        db_table = 'obs_deployments'
        indexes = [
            models.Index(fields=['project', 'service', 'started_at']),
        ]
        ordering = ['-started_at']


# ---- SLOs ----

class SLO(models.Model):
    """Service Level Objectives configured by user"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='slos')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    service_name = models.CharField(max_length=255)
    sli_type = models.CharField(max_length=50)  # availability, latency, error_rate, throughput
    target_percentage = models.FloatField()
    time_window_days = models.IntegerField(default=30)
    current_value = models.FloatField(default=100.0)
    error_budget_remaining = models.FloatField(default=100.0)
    status = models.CharField(max_length=20, default='met')  # met, at_risk, breached
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_slos'
        indexes = [
            models.Index(fields=['project', 'service_name']),
        ]
        ordering = ['-created_at']


# ---- Dashboards ----

class Dashboard(models.Model):
    """Custom dashboards created by user"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='dashboards')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    widgets = models.JSONField(default=list, blank=True)
    variables = models.JSONField(default=list, blank=True)
    layout = models.JSONField(default=dict, blank=True)
    is_default = models.BooleanField(default=False)
    created_by = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_dashboards'
        indexes = [
            models.Index(fields=['project']),
        ]
        ordering = ['-updated_at']


# ---- Alerting ----

class AlertCondition(models.Model):
    """Alert condition definitions"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='alert_conditions')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    condition_type = models.CharField(max_length=50)  # threshold, anomaly, rate_change
    metric_name = models.CharField(max_length=255)
    service_name = models.CharField(max_length=255, blank=True, default='')
    operator = models.CharField(max_length=10)  # >, <, >=, <=, ==, !=
    threshold = models.FloatField()
    duration_minutes = models.IntegerField(default=5)
    severity = models.CharField(max_length=20, default='warning')  # critical, high, medium, low, warning
    is_enabled = models.BooleanField(default=True)
    policy = models.ForeignKey('AlertPolicy', on_delete=models.SET_NULL, null=True, blank=True, related_name='conditions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_alert_conditions'
        indexes = [
            models.Index(fields=['project', 'is_enabled']),
        ]
        ordering = ['-created_at']


class AlertPolicy(models.Model):
    """Alert policy grouping conditions with notification channels"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='alert_policies')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    is_enabled = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_alert_policies'
        ordering = ['-created_at']


class NotificationChannel(models.Model):
    """Notification channel for delivering alerts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='notification_channels')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    channel_type = models.CharField(max_length=50)  # email, slack, pagerduty, teams, webhook
    config = models.JSONField(default=dict)  # Encrypted: webhook_url, api_key, email, etc.
    is_enabled = models.BooleanField(default=True)
    policies = models.ManyToManyField(AlertPolicy, related_name='notification_channels', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_notification_channels'
        ordering = ['-created_at']


class ActiveAlert(models.Model):
    """Currently active/firing alerts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='active_alerts')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)
    condition = models.ForeignKey(AlertCondition, on_delete=models.CASCADE, related_name='active_alerts', null=True)

    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default='')
    severity = models.CharField(max_length=20, default='warning')
    status = models.CharField(max_length=20, default='firing')  # firing, acknowledged, resolved
    service_name = models.CharField(max_length=255, blank=True, default='')
    metric_value = models.FloatField(null=True, blank=True)
    fired_at = models.DateTimeField(auto_now_add=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_active_alerts'
        indexes = [
            models.Index(fields=['project', 'status']),
        ]
        ordering = ['-fired_at']


class MutingRule(models.Model):
    """Rules for muting alerts"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='muting_rules')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default='')
    matchers = models.JSONField(default=dict)  # conditions to match alerts
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_by = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_muting_rules'
        ordering = ['-created_at']


# ---- Synthetic Monitoring ----

class SyntheticMonitor(models.Model):
    """Synthetic monitoring checks configured by user"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='synthetic_monitors')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    name = models.CharField(max_length=255)
    monitor_type = models.CharField(max_length=50)  # ping, api, browser, scripted
    url = models.CharField(max_length=1000)
    frequency_seconds = models.IntegerField(default=300)
    locations = models.JSONField(default=list)  # ["us-east-1", "eu-west-1"]
    config = models.JSONField(default=dict)  # headers, body, assertions, etc.
    is_enabled = models.BooleanField(default=True)
    status = models.CharField(max_length=20, default='unknown')  # passing, failing, unknown
    last_check_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_synthetic_monitors'
        indexes = [
            models.Index(fields=['project', 'is_enabled']),
        ]
        ordering = ['-created_at']


class SyntheticResult(models.Model):
    """Result of a synthetic monitoring check"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE)
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)
    monitor = models.ForeignKey(SyntheticMonitor, on_delete=models.CASCADE, related_name='results')

    success = models.BooleanField()
    response_time_ms = models.FloatField()
    status_code = models.IntegerField(null=True, blank=True)
    location = models.CharField(max_length=50, blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    timestamp = models.DateTimeField(db_index=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_synthetic_results'
        indexes = [
            models.Index(fields=['monitor', 'timestamp']),
        ]
        ordering = ['-timestamp']


# ---- Vulnerability Management ----

class Vulnerability(models.Model):
    """Vulnerability scan results from user's security scanning"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='vulnerabilities')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    cve_id = models.CharField(max_length=50, db_index=True)
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True, default='')
    severity = models.CharField(max_length=20)  # critical, high, medium, low
    service_name = models.CharField(max_length=255)
    package_name = models.CharField(max_length=255)
    installed_version = models.CharField(max_length=100)
    fixed_version = models.CharField(max_length=100, blank=True, default='')
    status = models.CharField(max_length=20, default='open')  # open, in_progress, fixed, ignored
    source = models.CharField(max_length=50, default='unknown')  # pip-audit, npm-audit, bandit, trivy, dependabot
    first_detected = models.DateTimeField(auto_now_add=True)
    last_detected = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_vulnerabilities'
        indexes = [
            models.Index(fields=['project', 'severity']),
            models.Index(fields=['project', 'service_name']),
        ]
        unique_together = [('project', 'cve_id', 'service_name', 'package_name')]
        ordering = ['-last_detected']


# ---- Browser / RUM ----

class BrowserEvent(models.Model):
    """Browser monitoring / Real User Monitoring data"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='browser_events')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    app_name = models.CharField(max_length=255, blank=True, default='')
    url = models.CharField(max_length=2000, blank=True, default='')
    web_vitals = models.JSONField(default=list, blank=True)
    errors = models.JSONField(default=list, blank=True)
    page_load = models.JSONField(default=dict, blank=True)
    xhr_events = models.JSONField(default=list, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_browser_events'
        indexes = [
            models.Index(fields=['project', 'timestamp']),
            models.Index(fields=['project', 'app_name']),
        ]
        ordering = ['-timestamp']


# ---- Service Registry / Discovery ----

class ServiceRegistration(models.Model):
    """Auto-discovered or manually registered services"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='registered_services')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    service_name = models.CharField(max_length=255)
    service_type = models.CharField(max_length=50, default='backend')  # backend, frontend, database, cache, worker, cloud_vm, container
    language = models.CharField(max_length=50, blank=True, default='')  # python, nodejs, java, go, etc.
    url = models.CharField(max_length=500, blank=True, default='')
    health_check_path = models.CharField(max_length=200, blank=True, default='/health')
    status = models.CharField(max_length=20, default='unknown')  # healthy, unhealthy, unknown
    last_heartbeat = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)  # version, tags, cloud_region, etc.
    source = models.CharField(max_length=50, default='sdk')  # sdk, agent, cloud_discovery, manual
    first_seen = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'obs_service_registrations'
        indexes = [
            models.Index(fields=['project', 'service_name']),
        ]
        unique_together = [('project', 'service_name')]
        ordering = ['service_name']
