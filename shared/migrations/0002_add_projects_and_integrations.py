# Generated migration for Project, ProjectMember, Integration models

from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('shared', '0001_initial'),
    ]

    operations = [
        # Create Project table
        migrations.CreateModel(
            name='Project',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('slug', models.SlugField(max_length=100)),
                ('description', models.TextField(blank=True)),
                ('timezone', models.CharField(default='UTC', max_length=50)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('tenant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='projects', to='shared.tenant')),
            ],
            options={
                'db_table': 'projects',
            },
        ),
        migrations.AddIndex(
            model_name='project',
            index=models.Index(fields=['tenant', 'is_active'], name='projects_tenant_active_idx'),
        ),
        migrations.AddIndex(
            model_name='project',
            index=models.Index(fields=['slug'], name='projects_slug_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='project',
            unique_together={('tenant', 'slug')},
        ),

        # Create ProjectMember table
        migrations.CreateModel(
            name='ProjectMember',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('role', models.CharField(choices=[('owner', 'Owner'), ('admin', 'Admin'), ('engineer', 'Engineer'), ('viewer', 'Viewer')], default='engineer', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='members', to='shared.project')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='project_memberships', to='shared.user')),
            ],
            options={
                'db_table': 'project_members',
            },
        ),
        migrations.AddIndex(
            model_name='projectmember',
            index=models.Index(fields=['project', 'role'], name='project_members_project_role_idx'),
        ),
        migrations.AddIndex(
            model_name='projectmember',
            index=models.Index(fields=['user'], name='project_members_user_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='projectmember',
            unique_together={('project', 'user')},
        ),

        # Create Integration table
        migrations.CreateModel(
            name='Integration',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('integration_type', models.CharField(choices=[('prometheus', 'Prometheus'), ('grafana', 'Grafana'), ('alertmanager', 'AlertManager'), ('datadog', 'Datadog'), ('pagerduty', 'PagerDuty'), ('slack', 'Slack'), ('github', 'GitHub')], max_length=50)),
                ('name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('config', models.JSONField(help_text='Connection details: url, api_key, credentials, etc.')),
                ('is_active', models.BooleanField(default=True)),
                ('poll_interval', models.IntegerField(default=60, help_text='Polling interval in seconds (for pull-based integrations)')),
                ('last_successful_poll', models.DateTimeField(blank=True, null=True)),
                ('last_error', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('project', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='integrations', to='shared.project')),
            ],
            options={
                'db_table': 'integrations',
            },
        ),
        migrations.AddIndex(
            model_name='integration',
            index=models.Index(fields=['project', 'is_active'], name='integrations_project_active_idx'),
        ),
        migrations.AddIndex(
            model_name='integration',
            index=models.Index(fields=['integration_type'], name='integrations_type_idx'),
        ),
        migrations.AlterUniqueTogether(
            name='integration',
            unique_together={('project', 'integration_type', 'name')},
        ),

        # Add project FK to Incident
        migrations.AddField(
            model_name='incident',
            name='project',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name='incidents', to='shared.project'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['project', 'state'], name='incidents_project_state_idx'),
        ),
        migrations.AddIndex(
            model_name='incident',
            index=models.Index(fields=['project', 'detected_at'], name='incidents_project_detected_idx'),
        ),
    ]
