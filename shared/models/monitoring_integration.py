"""
Monitoring Integration Models - Prometheus & Grafana Configuration
"""
import uuid
from django.db import models
from django.utils import timezone
from shared.models.project import Project
from cryptography.fernet import Fernet
import os
import base64


class MonitoringIntegration(models.Model):
    """
    Stores monitoring tool (Prometheus/Grafana) configuration per project

    Design: Each project can have one Prometheus and one Grafana integration initially.
    Schema designed to support multiple integrations per project in future.
    """

    INTEGRATION_TYPE_CHOICES = [
        ('prometheus', 'Prometheus'),
        ('grafana', 'Grafana'),
        ('alertmanager', 'Alert Manager'),
    ]

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('error', 'Error'),
        ('testing', 'Testing'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        Project,
        on_delete=models.CASCADE,
        related_name='monitoring_integrations'
    )

    # Integration type and metadata
    integration_type = models.CharField(
        max_length=50,
        choices=INTEGRATION_TYPE_CHOICES,
        help_text="Type of monitoring integration"
    )
    name = models.CharField(
        max_length=255,
        help_text="Friendly name for this integration (e.g., 'Production Prometheus')"
    )
    description = models.TextField(
        blank=True,
        null=True,
        help_text="Optional description of this integration"
    )

    # Connection details
    url = models.URLField(
        max_length=500,
        help_text="Base URL for the monitoring service (e.g., http://prometheus:9090)"
    )
    username = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Username for authentication (if required)"
    )
    password_encrypted = models.BinaryField(
        blank=True,
        null=True,
        help_text="Encrypted password/API key"
    )
    api_key_encrypted = models.BinaryField(
        blank=True,
        null=True,
        help_text="Encrypted API key (for services that use API keys)"
    )

    # Additional configuration (stored as JSON)
    config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional configuration parameters (scrape_interval, timeout, etc.)"
    )

    # Status and health
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='inactive',
        help_text="Current status of this integration"
    )
    last_test_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Last time connection was tested"
    )
    last_test_success = models.BooleanField(
        default=False,
        help_text="Whether last connection test was successful"
    )
    last_error_message = models.TextField(
        blank=True,
        null=True,
        help_text="Error message from last failed connection attempt"
    )

    # Webhook configuration (for receiving alerts)
    webhook_enabled = models.BooleanField(
        default=True,
        help_text="Whether to enable webhook for receiving alerts from this integration"
    )
    webhook_secret = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="Secret token for webhook authentication"
    )

    # Metadata
    is_primary = models.BooleanField(
        default=False,
        help_text="Whether this is the primary integration for this type (for future multi-integration support)"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        'shared.User',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_monitoring_integrations'
    )

    class Meta:
        db_table = 'monitoring_integrations'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'integration_type']),
            models.Index(fields=['project', 'integration_type', 'is_primary']),
            models.Index(fields=['status']),
        ]
        # Ensure only one primary integration of each type per project
        constraints = [
            models.UniqueConstraint(
                fields=['project', 'integration_type', 'is_primary'],
                condition=models.Q(is_primary=True),
                name='unique_primary_integration_per_type'
            )
        ]

    def __str__(self):
        return f"{self.project.name} - {self.get_integration_type_display()} - {self.name}"

    @staticmethod
    def get_encryption_key():
        """Get or create encryption key for sensitive data"""
        key = os.getenv('MONITORING_ENCRYPTION_KEY')
        if not key:
            # Generate a new key if not set (should be set in production)
            key = Fernet.generate_key().decode()
            print(f"⚠️  WARNING: Using auto-generated encryption key. Set MONITORING_ENCRYPTION_KEY in .env")

        # Ensure key is bytes
        if isinstance(key, str):
            key = key.encode()

        return key

    def encrypt_field(self, value: str) -> bytes:
        """Encrypt a sensitive field value"""
        if not value:
            return None

        key = self.get_encryption_key()
        f = Fernet(key)
        return f.encrypt(value.encode())

    def decrypt_field(self, encrypted_value: bytes) -> str:
        """Decrypt a sensitive field value"""
        if not encrypted_value:
            return None

        key = self.get_encryption_key()
        f = Fernet(key)
        return f.decrypt(encrypted_value).decode()

    def set_password(self, password: str):
        """Set and encrypt password"""
        self.password_encrypted = self.encrypt_field(password)

    def get_password(self) -> str:
        """Get decrypted password"""
        return self.decrypt_field(self.password_encrypted)

    def set_api_key(self, api_key: str):
        """Set and encrypt API key"""
        self.api_key_encrypted = self.encrypt_field(api_key)

    def get_api_key(self) -> str:
        """Get decrypted API key"""
        return self.decrypt_field(self.api_key_encrypted)

    def generate_webhook_secret(self):
        """Generate a secure webhook secret"""
        import secrets
        self.webhook_secret = secrets.token_urlsafe(32)

    def get_webhook_url(self):
        """Get the webhook URL for this integration"""
        # Assumes integration service is accessible
        integration_service_url = os.getenv('INTEGRATION_SERVICE_URL', 'http://integration-service:8004')
        return f"{integration_service_url}/webhooks/{self.integration_type}/{self.id}"

    def to_dict(self, include_secrets=False):
        """Convert to dictionary for API responses"""
        data = {
            'id': str(self.id),
            'project_id': str(self.project_id),
            'project_name': self.project.name,
            'integration_type': self.integration_type,
            'integration_type_display': self.get_integration_type_display(),
            'name': self.name,
            'description': self.description,
            'url': self.url,
            'username': self.username,
            'config': self.config,
            'status': self.status,
            'status_display': self.get_status_display(),
            'last_test_at': self.last_test_at.isoformat() if self.last_test_at else None,
            'last_test_success': self.last_test_success,
            'last_error_message': self.last_error_message,
            'webhook_enabled': self.webhook_enabled,
            'webhook_url': self.get_webhook_url() if self.webhook_enabled else None,
            'is_primary': self.is_primary,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }

        if include_secrets:
            data['password'] = self.get_password()
            data['api_key'] = self.get_api_key()
            data['webhook_secret'] = self.webhook_secret

        return data


class MonitoringAlert(models.Model):
    """
    Stores alerts received from monitoring integrations
    Links alerts to the integration that sent them
    """

    ALERT_STATUS_CHOICES = [
        ('firing', 'Firing'),
        ('resolved', 'Resolved'),
        ('acknowledged', 'Acknowledged'),
    ]

    SEVERITY_CHOICES = [
        ('critical', 'Critical'),
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
        ('info', 'Info'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    integration = models.ForeignKey(
        MonitoringIntegration,
        on_delete=models.CASCADE,
        related_name='alerts',
        help_text="The monitoring integration that sent this alert"
    )

    # Alert details
    alert_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=ALERT_STATUS_CHOICES, default='firing')
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default='medium')

    summary = models.TextField(help_text="Short summary of the alert")
    description = models.TextField(blank=True, null=True, help_text="Detailed description")

    # Prometheus/Grafana specific fields
    labels = models.JSONField(default=dict, help_text="Alert labels")
    annotations = models.JSONField(default=dict, help_text="Alert annotations")

    # Timing
    starts_at = models.DateTimeField(help_text="When the alert started firing")
    ends_at = models.DateTimeField(null=True, blank=True, help_text="When the alert resolved")

    # External references
    external_url = models.URLField(max_length=500, blank=True, null=True)
    fingerprint = models.CharField(max_length=255, blank=True, null=True)

    # Incident linkage
    incident = models.ForeignKey(
        'shared.Incident',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitoring_alerts',
        help_text="Incident created from this alert"
    )

    # Metadata
    raw_payload = models.JSONField(default=dict, help_text="Original webhook payload")
    received_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'monitoring_alerts'
        ordering = ['-received_at']
        indexes = [
            models.Index(fields=['integration', 'status']),
            models.Index(fields=['integration', 'received_at']),
            models.Index(fields=['incident']),
            models.Index(fields=['fingerprint']),
        ]

    def __str__(self):
        return f"{self.alert_name} - {self.status} - {self.severity}"

    def to_dict(self):
        """Convert to dictionary for API responses"""
        return {
            'id': str(self.id),
            'integration_id': str(self.integration_id),
            'integration_name': self.integration.name,
            'integration_type': self.integration.integration_type,
            'alert_name': self.alert_name,
            'status': self.status,
            'status_display': self.get_status_display(),
            'severity': self.severity,
            'severity_display': self.get_severity_display(),
            'summary': self.summary,
            'description': self.description,
            'labels': self.labels,
            'annotations': self.annotations,
            'starts_at': self.starts_at.isoformat(),
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'external_url': self.external_url,
            'fingerprint': self.fingerprint,
            'incident_id': str(self.incident_id) if self.incident_id else None,
            'received_at': self.received_at.isoformat(),
        }
