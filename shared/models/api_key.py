"""
Project API Key model for authenticating external agents/SDKs
"""
import hashlib
import secrets
import uuid

from django.db import models
from django.utils import timezone


def generate_api_key():
    """Generate a new API key with prefix 'srec_'"""
    raw = secrets.token_urlsafe(48)
    return f"srec_{raw}"


def hash_api_key(key: str) -> str:
    """SHA-256 hash of the API key for secure storage"""
    return hashlib.sha256(key.encode()).hexdigest()


class ProjectApiKey(models.Model):
    """
    API keys for authenticating ingest requests from user-installed agents/SDKs.
    The full key is shown ONCE at creation; only the hash is stored.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    project = models.ForeignKey(
        'shared.Project',
        on_delete=models.CASCADE,
        related_name='api_keys'
    )
    tenant = models.ForeignKey(
        'shared.Tenant',
        on_delete=models.CASCADE,
        related_name='api_keys'
    )

    # Key identification
    name = models.CharField(max_length=255, help_text="Friendly name, e.g. 'Production Agent Key'")
    key_prefix = models.CharField(max_length=12, help_text="First 12 chars shown in UI for identification")
    key_hash = models.CharField(max_length=128, unique=True, db_index=True, help_text="SHA-256 hash for lookup")

    # Scopes
    scopes = models.JSONField(
        default=list,
        help_text="Allowed scopes: ingest:metrics, ingest:logs, ingest:traces, ingest:errors, ingest:infrastructure, ingest:browser, ingest:vulnerabilities"
    )

    # Status
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Null means never expires")

    class Meta:
        app_label = 'shared'
        db_table = 'project_api_keys'
        indexes = [
            models.Index(fields=['key_hash']),
            models.Index(fields=['project', 'is_active']),
            models.Index(fields=['tenant']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.key_prefix}...)"

    @property
    def is_expired(self) -> bool:
        if self.expires_at is None:
            return False
        return timezone.now() > self.expires_at

    @property
    def is_valid(self) -> bool:
        return self.is_active and not self.is_expired

    @classmethod
    def create_key(cls, project, tenant, name: str, scopes: list = None):
        """
        Create a new API key. Returns (instance, raw_key).
        The raw_key is only available at creation time.
        """
        raw_key = generate_api_key()
        key_hash_value = hash_api_key(raw_key)
        key_prefix = raw_key[:12]

        if scopes is None:
            scopes = [
                "ingest:metrics",
                "ingest:logs",
                "ingest:traces",
                "ingest:errors",
                "ingest:infrastructure",
                "ingest:browser",
                "ingest:vulnerabilities",
            ]

        instance = cls(
            project=project,
            tenant=tenant,
            name=name,
            key_prefix=key_prefix,
            key_hash=key_hash_value,
            scopes=scopes,
        )
        return instance, raw_key

    @classmethod
    def lookup_by_key(cls, raw_key: str):
        """Look up an API key by its raw value"""
        key_hash_value = hash_api_key(raw_key)
        try:
            return cls.objects.select_related('project', 'tenant').get(key_hash=key_hash_value)
        except cls.DoesNotExist:
            return None

    @classmethod
    async def alookup_by_key(cls, raw_key: str):
        """Async look up an API key by its raw value"""
        key_hash_value = hash_api_key(raw_key)
        try:
            return await cls.objects.select_related('project', 'tenant').aget(key_hash=key_hash_value)
        except cls.DoesNotExist:
            return None

    def update_last_used(self):
        """Update last_used_at timestamp"""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])

    async def aupdate_last_used(self):
        """Async update last_used_at timestamp"""
        self.last_used_at = timezone.now()
        await self.asave(update_fields=['last_used_at'])
