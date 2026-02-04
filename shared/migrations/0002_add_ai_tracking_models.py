"""
Migration for AI tracking models
"""
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='AIRequest',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('request_type', models.CharField(help_text="Type of AI request: 'hypothesis', 'log_analysis', 'solution', etc.", max_length=50)),
                ('input_tokens', models.IntegerField(default=0)),
                ('output_tokens', models.IntegerField(default=0)),
                ('total_tokens', models.IntegerField(default=0)),
                ('cost_usd', models.DecimalField(decimal_places=6, default=0.0, help_text='Cost in USD based on token usage', max_digits=10)),
                ('duration_ms', models.IntegerField(default=0, help_text='Request duration in milliseconds')),
                ('model_used', models.CharField(default='gpt-4o-mini', help_text='AI model used for this request', max_length=50)),
                ('prompt_summary', models.TextField(blank=True, help_text='Summary of the prompt sent')),
                ('response_summary', models.TextField(blank=True, help_text='Summary of the response received')),
                ('error_message', models.TextField(blank=True, help_text='Error message if request failed')),
                ('success', models.BooleanField(default=True, help_text='Whether the request was successful')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='ai_requests', to='shared.Incident')),
            ],
            options={
                'db_table': 'ai_requests',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='AnalysisStep',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('step_type', models.CharField(choices=[('alert_received', 'Alert Received'), ('source_identified', 'Source Identified'), ('platform_details', 'Platform Details Fetched'), ('logs_fetched', 'Logs Retrieved'), ('logs_analyzed', 'Logs Analyzed'), ('hypothesis_generated', 'Hypothesis Generated'), ('solution_generated', 'Solution Generated'), ('metrics_fetched', 'Metrics Fetched'), ('metrics_analyzed', 'Metrics Analyzed')], help_text='Type of analysis step', max_length=50)),
                ('step_number', models.IntegerField(default=0, help_text='Order of this step in the workflow')),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('in_progress', 'In Progress'), ('completed', 'Completed'), ('failed', 'Failed'), ('skipped', 'Skipped')], default='pending', max_length=20)),
                ('input_data', models.JSONField(blank=True, help_text='Input data for this step', null=True)),
                ('output_data', models.JSONField(blank=True, help_text='Output data from this step', null=True)),
                ('input_tokens', models.IntegerField(blank=True, help_text='Input tokens used in this step', null=True)),
                ('output_tokens', models.IntegerField(blank=True, help_text='Output tokens used in this step', null=True)),
                ('total_tokens', models.IntegerField(blank=True, help_text='Total tokens used in this step', null=True)),
                ('cost_usd', models.DecimalField(blank=True, decimal_places=6, help_text='Cost in USD for this step (if AI was used)', max_digits=10, null=True)),
                ('duration_ms', models.IntegerField(blank=True, help_text='Duration of this step in milliseconds', null=True)),
                ('error_message', models.TextField(blank=True, help_text='Error message if step failed')),
                ('started_at', models.DateTimeField(blank=True, null=True)),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='analysis_steps', to='shared.Incident')),
            ],
            options={
                'db_table': 'analysis_steps',
                'ordering': ['incident', 'step_number'],
            },
        ),
        migrations.AddIndex(
            model_name='airequest',
            index=models.Index(fields=['incident', 'created_at'], name='ai_requests_incident_created_idx'),
        ),
        migrations.AddIndex(
            model_name='airequest',
            index=models.Index(fields=['request_type', 'created_at'], name='ai_requests_type_created_idx'),
        ),
        migrations.AddIndex(
            model_name='airequest',
            index=models.Index(fields=['created_at'], name='ai_requests_created_idx'),
        ),
        migrations.AddIndex(
            model_name='analysisstep',
            index=models.Index(fields=['incident', 'step_number'], name='analysis_steps_incident_step_idx'),
        ),
        migrations.AddIndex(
            model_name='analysisstep',
            index=models.Index(fields=['incident', 'status'], name='analysis_steps_incident_status_idx'),
        ),
        migrations.AddIndex(
            model_name='analysisstep',
            index=models.Index(fields=['step_type', 'status'], name='analysis_steps_type_status_idx'),
        ),
    ]
