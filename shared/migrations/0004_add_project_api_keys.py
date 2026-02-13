# Migration to add ProjectApiKey model
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0003_merge_20260124_1631'),
    ]

    operations = [
        migrations.CreateModel(
            name='ProjectApiKey',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(help_text="Friendly name, e.g. 'Production Agent Key'", max_length=255)),
                ('key_prefix', models.CharField(help_text='First 12 chars shown in UI for identification', max_length=12)),
                ('key_hash', models.CharField(db_index=True, help_text='SHA-256 hash for lookup', max_length=128, unique=True)),
                ('scopes', models.JSONField(default=list, help_text='Allowed scopes: ingest:metrics, ingest:logs, ingest:traces, ingest:errors, ingest:infrastructure, ingest:browser, ingest:vulnerabilities')),
                ('is_active', models.BooleanField(default=True)),
                ('last_used_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('expires_at', models.DateTimeField(blank=True, help_text='Null means never expires', null=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='api_keys', to='shared.project')),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='api_keys', to='shared.tenant')),
            ],
            options={
                'db_table': 'project_api_keys',
                'ordering': ['-created_at'],
                'indexes': [
                    models.Index(fields=['key_hash'], name='shared_proje_key_has_idx'),
                    models.Index(fields=['project', 'is_active'], name='shared_proje_project_active_idx'),
                    models.Index(fields=['tenant'], name='shared_proje_tenant_idx'),
                ],
            },
        ),
    ]
