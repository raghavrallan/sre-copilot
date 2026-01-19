"""
Shared Incident models
"""
from django.db import models
import uuid


class IncidentState(models.TextChoices):
    DETECTED = 'detected', 'Detected'
    ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
    INVESTIGATING = 'investigating', 'Investigating'
    RESOLVED = 'resolved', 'Resolved'


class IncidentSeverity(models.TextChoices):
    CRITICAL = 'critical', 'Critical'
    HIGH = 'high', 'High'
    MEDIUM = 'medium', 'Medium'
    LOW = 'low', 'Low'


class Incident(models.Model):
    """Production incident"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    tenant = models.ForeignKey('Tenant', on_delete=models.CASCADE, related_name='incidents')

    # Identification
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)

    # Service
    service_name = models.CharField(max_length=255, db_index=True)

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

    # Timing
    detected_at = models.DateTimeField(db_index=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    # Context
    context_snapshot = models.JSONField(null=True, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        app_label = 'shared'
        db_table = 'incidents'
        indexes = [
            models.Index(fields=['tenant', 'state']),
            models.Index(fields=['tenant', 'detected_at']),
            models.Index(fields=['service_name']),
        ]

    def __str__(self):
        return f"[{self.severity}] {self.title}"


class Hypothesis(models.Model):
    """Root cause hypothesis"""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='hypotheses')

    # Claim
    claim = models.TextField()
    description = models.TextField(blank=True)

    # Confidence
    confidence_score = models.FloatField()

    # Evidence
    supporting_evidence = models.JSONField(default=list)

    # Ranking
    rank = models.IntegerField()

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'shared'
        db_table = 'hypotheses'
        ordering = ['rank']
        indexes = [
            models.Index(fields=['incident', 'rank']),
        ]

    def __str__(self):
        return f"#{self.rank}: {self.claim[:50]}..."
