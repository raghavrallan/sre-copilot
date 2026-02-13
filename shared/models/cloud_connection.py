"""
Cloud provider connection models - users connect their Azure/AWS/GCP accounts
"""
import uuid
from django.db import models


class CloudConnection(models.Model):
    """Connection to user's cloud provider account"""
    PROVIDER_CHOICES = [
        ('azure', 'Azure'),
        ('aws', 'AWS'),
        ('gcp', 'GCP'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('connected', 'Connected'),
        ('error', 'Error'),
        ('syncing', 'Syncing'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='cloud_connections')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    name = models.CharField(max_length=255)
    credentials_encrypted = models.TextField(blank=True, default='')  # Fernet-encrypted JSON
    config = models.JSONField(default=dict, blank=True)  # regions, resource groups, subscriptions, etc.

    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    status_message = models.TextField(blank=True, default='')
    last_sync_at = models.DateTimeField(null=True, blank=True)
    resources_count = models.IntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'cloud_connections'
        indexes = [
            models.Index(fields=['project', 'provider']),
            models.Index(fields=['project', 'is_active']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.provider})"
