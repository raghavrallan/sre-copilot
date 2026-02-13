"""
Generic connection configuration model - for database, redis, notification channels, etc.
"""
import uuid
from django.db import models


class ConnectionConfig(models.Model):
    """Generic connection configuration for various integrations"""
    CATEGORY_CHOICES = [
        ('database', 'Database'),
        ('redis', 'Redis / Cache'),
        ('notification_email', 'Email (SMTP)'),
        ('notification_slack', 'Slack'),
        ('notification_pagerduty', 'PagerDuty'),
        ('notification_teams', 'Microsoft Teams'),
        ('notification_webhook', 'Webhook'),
        ('observability_prometheus', 'Prometheus'),
        ('observability_grafana', 'Grafana'),
        ('observability_alertmanager', 'AlertManager'),
        ('ai_openai', 'OpenAI'),
        ('ai_azure_openai', 'Azure OpenAI'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='connection_configs')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    category = models.CharField(max_length=50, choices=CATEGORY_CHOICES)
    name = models.CharField(max_length=255)
    config_encrypted = models.TextField(blank=True, default='')  # Fernet-encrypted JSON
    config_display = models.JSONField(default=dict, blank=True)  # Non-sensitive fields for display

    is_active = models.BooleanField(default=True)
    last_tested_at = models.DateTimeField(null=True, blank=True)
    last_test_status = models.CharField(max_length=20, blank=True, default='')  # success, failed

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'connection_configs'
        indexes = [
            models.Index(fields=['project', 'category']),
        ]
        ordering = ['category', 'name']

    def __str__(self):
        return f"{self.name} ({self.category})"
