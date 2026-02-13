"""
CI/CD pipeline connection models - users connect their GitHub/Azure DevOps/GitLab accounts
"""
import uuid
from django.db import models


class CICDConnection(models.Model):
    """Connection to user's CI/CD pipeline provider"""
    PROVIDER_CHOICES = [
        ('github', 'GitHub'),
        ('azure_devops', 'Azure DevOps'),
        ('gitlab', 'GitLab'),
        ('jenkins', 'Jenkins'),
        ('bitbucket', 'Bitbucket'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('connected', 'Connected'),
        ('error', 'Error'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey('shared.Project', on_delete=models.CASCADE, related_name='cicd_connections')
    tenant = models.ForeignKey('shared.Tenant', on_delete=models.CASCADE)

    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES)
    name = models.CharField(max_length=255)
    credentials_encrypted = models.TextField(blank=True, default='')  # Fernet-encrypted JSON
    config = models.JSONField(default=dict, blank=True)  # org, repos, branches, etc.

    webhook_secret = models.CharField(max_length=128, blank=True, default='')
    webhook_url = models.CharField(max_length=500, blank=True, default='')

    is_active = models.BooleanField(default=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    status_message = models.TextField(blank=True, default='')
    last_sync_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'cicd_connections'
        indexes = [
            models.Index(fields=['project', 'provider']),
            models.Index(fields=['project', 'is_active']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.provider})"
