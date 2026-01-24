"""
Analysis Step model for tracking incident analysis workflow
"""
from django.db import models
from django.utils import timezone
import uuid


class AnalysisStepType(models.TextChoices):
    """Types of analysis steps in the incident workflow"""
    ALERT_RECEIVED = 'alert_received', 'Alert Received'
    SOURCE_IDENTIFIED = 'source_identified', 'Source Identified'
    PLATFORM_DETAILS = 'platform_details', 'Platform Details Fetched'
    LOGS_FETCHED = 'logs_fetched', 'Logs Retrieved'
    LOGS_ANALYZED = 'logs_analyzed', 'Logs Analyzed'
    HYPOTHESIS_GENERATED = 'hypothesis_generated', 'Hypothesis Generated'
    SOLUTION_GENERATED = 'solution_generated', 'Solution Generated'
    METRICS_FETCHED = 'metrics_fetched', 'Metrics Fetched'
    METRICS_ANALYZED = 'metrics_analyzed', 'Metrics Analyzed'


class AnalysisStepStatus(models.TextChoices):
    """Status of an analysis step"""
    PENDING = 'pending', 'Pending'
    IN_PROGRESS = 'in_progress', 'In Progress'
    COMPLETED = 'completed', 'Completed'
    FAILED = 'failed', 'Failed'
    SKIPPED = 'skipped', 'Skipped'


class AnalysisStep(models.Model):
    """
    Tracks each step in the incident analysis workflow
    Provides visibility into the AI pipeline and cost breakdown per step
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        'incident.Incident',
        on_delete=models.CASCADE,
        related_name='analysis_steps'
    )

    # Step identification
    step_type = models.CharField(
        max_length=50,
        choices=AnalysisStepType.choices,
        help_text="Type of analysis step"
    )
    step_number = models.IntegerField(
        default=0,
        help_text="Order of this step in the workflow"
    )
    status = models.CharField(
        max_length=20,
        choices=AnalysisStepStatus.choices,
        default=AnalysisStepStatus.PENDING
    )

    # Input/Output data
    input_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Input data for this step"
    )
    output_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Output data from this step"
    )

    # Token usage (if AI was used in this step)
    input_tokens = models.IntegerField(
        null=True,
        blank=True,
        help_text="Input tokens used in this step"
    )
    output_tokens = models.IntegerField(
        null=True,
        blank=True,
        help_text="Output tokens used in this step"
    )
    total_tokens = models.IntegerField(
        null=True,
        blank=True,
        help_text="Total tokens used in this step"
    )
    cost_usd = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Cost in USD for this step (if AI was used)"
    )

    # Performance metrics
    duration_ms = models.IntegerField(
        null=True,
        blank=True,
        help_text="Duration of this step in milliseconds"
    )

    # Error tracking
    error_message = models.TextField(
        blank=True,
        help_text="Error message if step failed"
    )

    # Timestamps
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'analysis_steps'
        indexes = [
            models.Index(fields=['incident', 'step_number']),
            models.Index(fields=['incident', 'status']),
            models.Index(fields=['step_type', 'status']),
        ]
        ordering = ['incident', 'step_number']

    def __str__(self):
        return f"Step {self.step_number}: {self.get_step_type_display()} - {self.status}"

    def start(self):
        """Mark step as in progress"""
        self.status = AnalysisStepStatus.IN_PROGRESS
        self.started_at = timezone.now()
        self.save()

    def complete(self, output_data=None):
        """Mark step as completed"""
        self.status = AnalysisStepStatus.COMPLETED
        self.completed_at = timezone.now()
        if output_data:
            self.output_data = output_data
        if self.started_at:
            self.duration_ms = int((self.completed_at - self.started_at).total_seconds() * 1000)
        self.save()

    def fail(self, error_message):
        """Mark step as failed"""
        self.status = AnalysisStepStatus.FAILED
        self.completed_at = timezone.now()
        self.error_message = error_message
        if self.started_at:
            self.duration_ms = int((self.completed_at - self.started_at).total_seconds() * 1000)
        self.save()

    def calculate_cost(self):
        """Calculate cost based on token usage"""
        if self.input_tokens and self.output_tokens:
            input_cost = (self.input_tokens / 1_000_000) * 0.150
            output_cost = (self.output_tokens / 1_000_000) * 0.600
            self.cost_usd = input_cost + output_cost
            self.total_tokens = self.input_tokens + self.output_tokens
            self.save()
