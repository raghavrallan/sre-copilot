# Generated manually for POC
from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = [
    ]

    operations = [
        migrations.CreateModel(
            name='Tenant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=100, unique=True)),
                ('plan_type', models.CharField(choices=[('starter', 'Starter'), ('professional', 'Professional'), ('enterprise', 'Enterprise')], default='starter', max_length=50)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'db_table': 'tenants',
            },
        ),
        migrations.CreateModel(
            name='User',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('hashed_password', models.CharField(max_length=255)),
                ('full_name', models.CharField(max_length=255)),
                ('role', models.CharField(choices=[('admin', 'Admin'), ('engineer', 'Engineer'), ('viewer', 'Viewer')], default='engineer', max_length=50)),
                ('is_active', models.BooleanField(default=True)),
                ('last_login_at', models.DateTimeField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='users', to='shared.tenant')),
            ],
            options={
                'db_table': 'users',
            },
        ),
        migrations.CreateModel(
            name='Incident',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=500)),
                ('description', models.TextField(blank=True)),
                ('service_name', models.CharField(db_index=True, max_length=255)),
                ('state', models.CharField(choices=[('detected', 'Detected'), ('acknowledged', 'Acknowledged'), ('investigating', 'Investigating'), ('resolved', 'Resolved')], db_index=True, default='detected', max_length=50)),
                ('severity', models.CharField(choices=[('critical', 'Critical'), ('high', 'High'), ('medium', 'Medium'), ('low', 'Low')], default='medium', max_length=50)),
                ('detected_at', models.DateTimeField(db_index=True)),
                ('acknowledged_at', models.DateTimeField(blank=True, null=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('context_snapshot', models.JSONField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='incidents', to='shared.tenant')),
            ],
            options={
                'db_table': 'incidents',
            },
        ),
        migrations.CreateModel(
            name='Hypothesis',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('claim', models.TextField()),
                ('description', models.TextField(blank=True)),
                ('confidence_score', models.FloatField()),
                ('supporting_evidence', models.JSONField(default=list)),
                ('rank', models.IntegerField()),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('incident', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hypotheses', to='shared.incident')),
            ],
            options={
                'db_table': 'hypotheses',
                'ordering': ['rank'],
            },
        ),
        migrations.AddIndex(
            model_name='tenant',
            index=models.Index(fields=['slug'], name='tenants_slug_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['email'], name='users_email_idx'),
        ),
        migrations.AddIndex(
            model_name='user',
            index=models.Index(fields=['tenant', 'role'], name='users_tenant_role_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['tenant', 'state'], name='incidents_tenant_state_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['tenant', 'detected_at'], name='incidents_tenant_detected_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['service_name'], name='incidents_service_idx'),
        ),
        migrations.AddIndex(
            model_name='hypothesis',
            index=models.Index(fields=['incident', 'rank'], name='hypotheses_incident_rank_idx'),
        ),
    ]
