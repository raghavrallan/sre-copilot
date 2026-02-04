"""
Shared Project models for multi-project support
"""
from django.db import models
from django.utils.text import slugify
import uuid


class Project(models.Model):
    """
    Project entity - Tenants can have multiple projects
    Each project has its own incidents, integrations, and team
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='projects')

    # Identification
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=100)
    description = models.TextField(blank=True)

    # Settings
    timezone = models.CharField(max_length=50, default='UTC')

    # Status
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'projects'
        unique_together = [('tenant', 'slug')]
        indexes = [
            models.Index(fields=['tenant', 'is_active']),
            models.Index(fields=['slug']),
        ]

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.tenant.name}/{self.name}"


class ProjectRole(models.TextChoices):
    """Project-level roles with hierarchical permissions"""
    OWNER = 'owner', 'Owner'  # Full control
    ADMIN = 'admin', 'Admin'  # Can manage members, integrations
    ENGINEER = 'engineer', 'Engineer'  # Can acknowledge incidents, view everything
    VIEWER = 'viewer', 'Viewer'  # Read-only access


class ProjectMember(models.Model):
    """
    User-Project association with role-based access control
    One user can be in multiple projects with different roles
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey('shared.User', on_delete=models.CASCADE, related_name='project_memberships')

    # Access Control
    role = models.CharField(
        max_length=50,
        choices=ProjectRole.choices,
        default=ProjectRole.ENGINEER
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'project_members'
        unique_together = [('project', 'user')]
        indexes = [
            models.Index(fields=['project', 'role']),
            models.Index(fields=['user']),
        ]

    def __str__(self):
        return f"{self.user.email} - {self.project.name} ({self.role})"


class IntegrationType(models.TextChoices):
    """Supported integration types"""
    PROMETHEUS = 'prometheus', 'Prometheus'
    GRAFANA = 'grafana', 'Grafana'
    ALERTMANAGER = 'alertmanager', 'AlertManager'
    DATADOG = 'datadog', 'Datadog'
    PAGERDUTY = 'pagerduty', 'PagerDuty'
    SLACK = 'slack', 'Slack'
    GITHUB = 'github', 'GitHub'


class Integration(models.Model):
    """
    Integration configurations per project
    Stores connection details for external systems
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='integrations')

    # Integration Info
    integration_type = models.CharField(
        max_length=50,
        choices=IntegrationType.choices
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)

    # Configuration (encrypted in production)
    config = models.JSONField(
        help_text="Connection details: url, api_key, credentials, etc."
    )

    # Settings
    is_active = models.BooleanField(default=True)
    poll_interval = models.IntegerField(
        default=60,
        help_text="Polling interval in seconds (for pull-based integrations)"
    )

    # Health
    last_successful_poll = models.DateTimeField(null=True, blank=True)
    last_error = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'integrations'
        unique_together = [('project', 'integration_type', 'name')]
        indexes = [
            models.Index(fields=['project', 'is_active']),
            models.Index(fields=['integration_type']),
        ]

    def __str__(self):
        return f"{self.project.name}/{self.integration_type}/{self.name}"
