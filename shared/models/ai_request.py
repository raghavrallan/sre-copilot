"""
AI Request model for tracking AI service usage, token consumption, and costs
"""
from django.db import models
from django.utils import timezone
import uuid
import os

# Pricing Configuration from environment (per 1M tokens)
AI_INPUT_TOKEN_PRICE = float(os.getenv("AI_INPUT_TOKEN_PRICE", "0.150"))
AI_OUTPUT_TOKEN_PRICE = float(os.getenv("AI_OUTPUT_TOKEN_PRICE", "0.600"))
AZURE_OPENAI_MODEL = os.getenv("AZURE_OPENAI_MODEL", "gpt-4o-mini")


class AIRequest(models.Model):
    """
    Tracks each AI service request for cost monitoring and optimization
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    incident = models.ForeignKey(
        'shared.Incident',
        on_delete=models.CASCADE,
        related_name='ai_requests'
    )
    request_type = models.CharField(
        max_length=50,
        help_text="Type of AI request: 'hypothesis', 'log_analysis', 'solution', etc."
    )

    # Token usage metrics
    input_tokens = models.IntegerField(default=0)
    output_tokens = models.IntegerField(default=0)
    total_tokens = models.IntegerField(default=0)

    # Cost tracking (in USD)
    cost_usd = models.DecimalField(
        max_digits=10,
        decimal_places=6,
        default=0.0,
        help_text="Cost in USD based on token usage"
    )

    # Performance metrics
    duration_ms = models.IntegerField(
        default=0,
        help_text="Request duration in milliseconds"
    )

    # Model information
    model_used = models.CharField(
        max_length=50,
        default=AZURE_OPENAI_MODEL,
        help_text="AI model used for this request"
    )

    # Additional metadata
    prompt_summary = models.TextField(
        blank=True,
        help_text="Summary of the prompt sent"
    )
    response_summary = models.TextField(
        blank=True,
        help_text="Summary of the response received"
    )
    error_message = models.TextField(
        blank=True,
        help_text="Error message if request failed"
    )
    success = models.BooleanField(
        default=True,
        help_text="Whether the request was successful"
    )

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'ai_requests'
        indexes = [
            models.Index(fields=['incident', 'created_at']),
            models.Index(fields=['request_type', 'created_at']),
            models.Index(fields=['created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"AIRequest {self.request_type} for Incident {self.incident_id} - {self.total_tokens} tokens (${self.cost_usd})"

    def calculate_cost(self):
        """
        Calculate cost based on token usage using env pricing
        Pricing configured via AI_INPUT_TOKEN_PRICE and AI_OUTPUT_TOKEN_PRICE
        """
        input_cost = (self.input_tokens / 1_000_000) * AI_INPUT_TOKEN_PRICE
        output_cost = (self.output_tokens / 1_000_000) * AI_OUTPUT_TOKEN_PRICE
        self.cost_usd = input_cost + output_cost
        self.total_tokens = self.input_tokens + self.output_tokens
        return self.cost_usd

    def save(self, *args, **kwargs):
        """Override save to auto-calculate cost"""
        self.calculate_cost()
        super().save(*args, **kwargs)
