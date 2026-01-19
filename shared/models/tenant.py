"""
Shared Tenant and User models
"""
from django.db import models
import uuid


class Tenant(models.Model):
    """Multi-tenant root entity"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True, max_length=100)

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

    # Status
    is_active = models.BooleanField(default=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'tenants'
        indexes = [
            models.Index(fields=['slug']),
        ]

    def __str__(self):
        return f"{self.name} ({self.slug})"


class User(models.Model):
    """User account (scoped to tenant)"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='users')

    # Authentication
    email = models.EmailField(unique=True)
    hashed_password = models.CharField(max_length=255)

    # Profile
    full_name = models.CharField(max_length=255)

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

    # Status
    is_active = models.BooleanField(default=True)
    last_login_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['tenant', 'role']),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.email})"
