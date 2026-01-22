# Sprint 1: Foundation (Weeks 1-4)

**Goal:** Build the foundational infrastructure and core integrations
**Duration:** 4 weeks
**Team:** 1 engineer (solo build)

---

## Sprint Objectives

By end of Sprint 1, we will have:
- ✅ Multi-tenant database with core schema
- ✅ Authentication working (JWT-based)
- ✅ Prometheus integration (metrics collection + alerts)
- ✅ Grafana integration (dashboard links + alerts)
- ✅ Azure OpenAI GPT-4 integration
- ✅ Basic API that can receive alerts and query AI
- ✅ Dummy application generating metrics

**Success Criteria:**
- Can authenticate via JWT
- Can query Prometheus metrics via PromQL
- Can receive Prometheus AlertManager webhooks
- Can receive Grafana alert webhooks
- Can send queries to Azure OpenAI GPT-4
- Prometheus scraping dummy app metrics successfully
- Grafana visualizing metrics successfully
- All services running in Docker locally

---

## Week 1: Project Setup & Database

### Day 1-2: Repository & Infrastructure Setup

**Tasks:**
- [ ] Create GitHub repositories
  - `sre-copilot-api` (FastAPI + Django ORM backend)
  - `sre-copilot-web` (React frontend)
  - `sre-copilot-infra` (Terraform IaC)
- [ ] Initialize backend project structure
  ```
  sre-copilot-api/
  ├── app/
  │   ├── __init__.py
  │   ├── main.py              # FastAPI app
  │   ├── api/                 # API routes
  │   │   ├── __init__.py
  │   │   ├── v1/
  │   │   │   ├── __init__.py
  │   │   │   ├── incidents.py
  │   │   │   ├── auth.py
  │   │   │   └── integrations.py
  │   ├── core/                # Core functionality
  │   │   ├── __init__.py
  │   │   ├── config.py
  │   │   ├── security.py
  │   │   └── database.py
  │   ├── models/              # Django ORM models
  │   │   ├── __init__.py
  │   │   ├── tenant.py
  │   │   ├── user.py
  │   │   ├── incident.py
  │   │   └── signal.py
  │   ├── ai/                  # AI integration
  │   │   ├── __init__.py
  │   │   ├── azure_openai.py
  │   │   └── prompts.py
  │   ├── ingestion/           # Signal ingestion
  │   │   ├── __init__.py
  │   │   ├── receivers.py
  │   │   └── normalizers.py
  │   └── settings.py          # Django settings
  ├── tests/
  ├── requirements.txt
  ├── Dockerfile
  └── docker-compose.yml
  ```
- [ ] Set up local development environment
  - Docker + Docker Compose
  - PostgreSQL container
  - Redis container
- [ ] Initialize Django with FastAPI integration
  - Configure Django ORM in standalone mode (no Django web framework)
  - FastAPI as main app, Django ORM for database operations
- [ ] Set up GitHub Actions for CI
  - Linting (ruff, black)
  - Type checking (mypy)
  - Tests (pytest)

**Deliverable:** Repository structure with working Docker Compose stack

---

### Day 3-5: Database Schema & Migrations

**Tasks:**
- [ ] Design multi-tenant database schema (see `docs/data-models/`)
- [ ] Create Django models:

```python
# models/tenant.py
from django.db import models
import uuid

class Tenant(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    name = models.CharField(max_length=255)
    slug = models.SlugField(unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Subscription info
    plan_type = models.CharField(max_length=50)  # starter, professional, enterprise
    max_services = models.IntegerField(default=5)

    # Status
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'tenants'
        indexes = [
            models.Index(fields=['slug']),
        ]

# models/user.py
class User(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='users')

    # Auth fields
    email = models.EmailField(unique=True)
    azure_ad_id = models.CharField(max_length=255, unique=True, null=True)

    # Profile
    full_name = models.CharField(max_length=255)
    role = models.CharField(max_length=50)  # admin, engineer, viewer

    # Slack info
    slack_user_id = models.CharField(max_length=50, null=True)

    # Status
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'users'
        indexes = [
            models.Index(fields=['email']),
            models.Index(fields=['tenant', 'role']),
        ]

# models/incident.py
class IncidentState(models.TextChoices):
    DETECTED = 'detected', 'Detected'
    ACKNOWLEDGED = 'acknowledged', 'Acknowledged'
    INVESTIGATING = 'investigating', 'Investigating'
    MITIGATED = 'mitigated', 'Mitigated'
    RESOLVED = 'resolved', 'Resolved'
    LEARNED = 'learned', 'Learned'
    INCONCLUSIVE = 'inconclusive', 'Inconclusive'

class Incident(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='incidents')

    # Identification
    external_id = models.CharField(max_length=255, null=True)  # PagerDuty incident ID
    title = models.CharField(max_length=500)
    service_name = models.CharField(max_length=255)

    # State
    state = models.CharField(max_length=50, choices=IncidentState.choices, default=IncidentState.DETECTED)
    severity = models.CharField(max_length=50)  # critical, warning, info

    # Timing
    detected_at = models.DateTimeField()
    acknowledged_at = models.DateTimeField(null=True)
    mitigated_at = models.DateTimeField(null=True)
    resolved_at = models.DateTimeField(null=True)

    # Ownership
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='assigned_incidents')

    # Slack
    slack_thread_ts = models.CharField(max_length=50, null=True)
    slack_channel_id = models.CharField(max_length=50, null=True)

    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'incidents'
        indexes = [
            models.Index(fields=['tenant', 'state']),
            models.Index(fields=['tenant', 'detected_at']),
            models.Index(fields=['service_name']),
        ]

# models/signal.py
class SignalType(models.TextChoices):
    ALERT = 'alert', 'Alert'
    METRIC_DEVIATION = 'metric_deviation', 'Metric Deviation'
    LOG_PATTERN = 'log_pattern', 'Log Pattern'
    DEPLOY_EVENT = 'deploy_event', 'Deploy Event'

class Signal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='signals')
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE, null=True, related_name='signals')

    # Classification
    signal_type = models.CharField(max_length=50, choices=SignalType.choices)
    source = models.CharField(max_length=100)  # prometheus, pagerduty, etc.
    severity = models.CharField(max_length=50)

    # Content
    raw_data = models.JSONField()
    normalized_data = models.JSONField()

    # Context
    service_name = models.CharField(max_length=255, null=True)
    context_snapshot_id = models.UUIDField(null=True)

    # Deduplication
    fingerprint = models.CharField(max_length=64, db_index=True)  # Hash for dedup

    # Timing
    timestamp = models.DateTimeField(db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'signals'
        indexes = [
            models.Index(fields=['tenant', 'timestamp']),
            models.Index(fields=['fingerprint', 'timestamp']),
            models.Index(fields=['incident']),
        ]
```

- [ ] Create initial Django migrations
- [ ] Set up database connection pooling
- [ ] Test migrations locally

**Deliverable:** Working database schema with migrations

---

### Day 6-7: Testing & Documentation

**Tasks:**
- [ ] Write database model tests
- [ ] Create sample data seed script
- [ ] Document database schema (ERD diagram)
- [ ] Set up database backup strategy (local)

**Deliverable:** Tested database layer with documentation

---

## Week 2: Authentication & API Gateway

### Day 1-3: Azure AD Integration

**Tasks:**
- [ ] Set up Azure AD app registration
  - Configure redirect URIs
  - Set up API permissions
  - Generate client secret
- [ ] Implement OAuth 2.0 flow in FastAPI
  ```python
  # core/security.py
  from fastapi import Depends, HTTPException, status
  from fastapi.security import OAuth2AuthorizationCodeBearer
  import jwt
  from azure.identity import DefaultAzureCredential

  oauth2_scheme = OAuth2AuthorizationCodeBearer(
      authorizationUrl="https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/authorize",
      tokenUrl="https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token",
  )

  async def get_current_user(token: str = Depends(oauth2_scheme)):
      # Verify JWT token
      # Decode user info
      # Return user object
      pass
  ```
- [ ] Implement JWT token generation and validation
- [ ] Create refresh token mechanism
- [ ] Store Azure AD configuration in environment variables

**Deliverable:** Working Azure AD SSO login flow

---

### Day 4-5: RBAC & Audit Logging

**Tasks:**
- [ ] Create Django models for audit logs
  ```python
  # models/audit_log.py
  class AuditLog(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4)
      tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)
      user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

      # Event details
      event_type = models.CharField(max_length=100)
      resource_type = models.CharField(max_length=100, null=True)
      resource_id = models.UUIDField(null=True)
      action = models.CharField(max_length=50)  # create, update, delete, view

      # Context
      ip_address = models.GenericIPAddressField(null=True)
      user_agent = models.CharField(max_length=500, null=True)
      details = models.JSONField()

      # Timing
      timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

      class Meta:
          db_table = 'audit_logs'
          indexes = [
              models.Index(fields=['tenant', 'timestamp']),
              models.Index(fields=['user', 'timestamp']),
          ]
  ```
- [ ] Implement RBAC middleware
  ```python
  # core/security.py
  def require_role(*allowed_roles):
      async def role_checker(current_user: User = Depends(get_current_user)):
          if current_user.role not in allowed_roles:
              raise HTTPException(status_code=403, detail="Insufficient permissions")
          return current_user
      return role_checker
  ```
- [ ] Create audit logging decorator
- [ ] Test RBAC enforcement

**Deliverable:** Working RBAC with audit trail

---

## Week 3: Integrations (Prometheus & Grafana)

### Day 1-3: Prometheus Integration

**Tasks:**
- [ ] Create Prometheus client wrapper
  ```python
  # integrations/prometheus.py
  from prometheus_api_client import PrometheusConnect

  class PrometheusIntegration:
      def __init__(self, url: str, headers: dict = None):
          self.client = PrometheusConnect(url=url, headers=headers)

      async def query_metric(self, query: str, time: datetime = None):
          # Execute PromQL query
          pass

      async def query_range(self, query: str, start: datetime, end: datetime):
          # Execute range query
          pass

      async def get_service_metrics(self, service_name: str):
          # Get key metrics for a service
          pass
  ```
- [ ] Create integration configuration models
  ```python
  # models/integration.py
  class Integration(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4)
      tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE)

      # Type
      integration_type = models.CharField(max_length=50)  # prometheus, pagerduty
      name = models.CharField(max_length=255)

      # Config (encrypted)
      config = models.JSONField()  # URL, credentials, etc.

      # Health
      is_healthy = models.BooleanField(default=True)
      last_sync_at = models.DateTimeField(null=True)
      last_error = models.TextField(null=True)

      # Status
      is_active = models.BooleanField(default=True)
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
          db_table = 'integrations'
  ```
- [ ] Implement Prometheus metric query API
  ```python
  # api/v1/integrations.py
  @router.post("/integrations/prometheus/test")
  async def test_prometheus_connection(config: PrometheusConfig):
      # Test connection
      pass

  @router.get("/integrations/prometheus/metrics")
  async def query_prometheus(query: str, time: datetime = None):
      # Query metrics
      pass
  ```
- [ ] Test with real Prometheus instance

**Deliverable:** Working Prometheus integration

---

### Day 4-5: Grafana Integration & Alert Receivers

**Tasks:**
- [ ] Create Grafana API client
  ```python
  # integrations/grafana.py
  import httpx

  class GrafanaIntegration:
      def __init__(self, url: str, api_key: str):
          self.base_url = url
          self.api_key = api_key

      async def get_dashboards(self):
          # Fetch all dashboards
          pass

      async def get_dashboard_by_service(self, service_name: str):
          # Find dashboard for specific service
          pass
  ```
- [ ] Create AlertManager webhook receiver for Prometheus
  ```python
  # api/v1/webhooks.py
  from fastapi import APIRouter, Request, Header

  router = APIRouter()

  @router.post("/webhooks/alertmanager")
  async def alertmanager_webhook(request: Request):
      body = await request.json()

      # Parse AlertManager format
      for alert in body.get('alerts', []):
          # Create incident from alert
          await create_incident_from_alert(alert, source='prometheus')

      return {"status": "received"}
  ```
- [ ] Create Grafana alert webhook receiver
  ```python
  @router.post("/webhooks/grafana")
  async def grafana_webhook(request: Request):
      body = await request.json()

      # Parse Grafana alert format
      await create_incident_from_alert(body, source='grafana')

      return {"status": "received"}
  ```
- [ ] Implement alert-to-incident mapping
  ```python
  # ingestion/alert_handler.py
  async def create_incident_from_alert(alert: dict, source: str):
      # Extract severity, service, description
      # Create incident record
      # Link to relevant dashboards
      pass
  ```
- [ ] Set up Redis queue for incident processing
- [ ] Test with mock alerts from Prometheus and Grafana

**Deliverable:** Working Prometheus AlertManager & Grafana webhook receivers

---

## Week 4: AI Integration & Context Assembly

### Day 1-2: Azure OpenAI Integration

**Tasks:**
- [ ] Set up Azure OpenAI client
  ```python
  # ai/azure_openai.py
  from openai import AsyncAzureOpenAI
  from typing import List, Dict
  import os

  class AzureOpenAIClient:
      def __init__(self):
          self.client = AsyncAzureOpenAI(
              api_key=os.getenv("AZURE_OPENAI_API_KEY"),
              api_version="2025-04-01-preview",
              azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
          )
          self.deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT", "sre-copilot-deployment-002")

      async def generate_hypotheses(
          self,
          context: dict,
          evidence: List[dict]
      ) -> List[dict]:
          # Generate hypothesis candidates using GPT-4
          pass

      async def explain_hypothesis(
          self,
          hypothesis: dict,
          evidence: List[dict]
      ) -> str:
          # Generate prose explanation
          pass
  ```
- [ ] Implement prompt caching strategy
  - Cache context snapshots (5min TTL)
  - Cache system topology (15min TTL)
  - Cache runbook corpus (1hr TTL)
- [ ] Create prompt templates
  ```python
  # ai/prompts.py
  HYPOTHESIS_GENERATION_PROMPT = """
  You are an expert SRE analyzing a production incident.

  Context:
  {context_snapshot}

  Evidence:
  {evidence_list}

  Generate 5-10 hypothesis candidates explaining the root cause.
  Each hypothesis must:
  - Be a clear, testable claim
  - Cite specific evidence
  - Note any contradicting evidence
  - Reference similar past incidents if applicable

  Output JSON format:
  [
    {
      "claim": "...",
      "supporting_evidence": [...],
      "contradicting_evidence": [...],
      "similar_incidents": [...]
    }
  ]
  """
  ```
- [ ] Test AI responses and iterate on prompts

**Deliverable:** Working Claude API integration with prompt caching

---

### Day 3-5: Context Assembly Engine

**Tasks:**
- [ ] Create context snapshot generator
  ```python
  # core/context.py
  class ContextSnapshot:
      async def generate(
          self,
          incident: Incident,
          tenant: Tenant
      ) -> dict:
          # Gather all context
          context = {
              "service_topology": await self._get_topology(incident.service_name),
              "recent_changes": await self._get_recent_changes(incident.service_name),
              "traffic_baseline": await self._get_traffic_baseline(incident.service_name),
              "dependency_health": await self._get_dependency_health(incident.service_name),
              "slo_state": await self._get_slo_state(incident.service_name),
              "correlated_signals": await self._get_correlated_signals(incident)
          }

          # Save snapshot
          await self._save_snapshot(incident.id, context)

          return context

      async def _get_topology(self, service_name: str):
          # Query service mesh or service registry
          pass

      async def _get_recent_changes(self, service_name: str):
          # Query deployments from last 24h
          pass
  ```
- [ ] Implement each context component:
  - Service topology (mock for now, real in Sprint 2)
  - Recent changes (Git integration stub)
  - Traffic baseline (Prometheus queries)
  - Dependency health (Prometheus queries)
  - SLO state (mock for now)
- [ ] Create context snapshot storage (JSONField in Incident model)
- [ ] Test context generation with real incident

**Deliverable:** Working context assembly engine

---

## Sprint 1 Demo & Review

### Day 6-7: Integration Testing & Demo

**Tasks:**
- [ ] End-to-end integration test:
  1. Trigger PagerDuty webhook
  2. Signal received and normalized
  3. Context snapshot generated
  4. Hypotheses generated via Claude API
  5. Results stored in database
- [ ] Performance testing
  - Measure latency at each step
  - Optimize slow queries
- [ ] Documentation
  - API documentation (OpenAPI/Swagger)
  - Setup guide for local development
  - Architecture decision records (ADRs)
- [ ] Demo preparation
  - Create demo video
  - Prepare slide deck showing progress

**Demo Checklist:**
- [ ] Can authenticate via Azure AD
- [ ] Can receive PagerDuty webhook
- [ ] Can query Prometheus metrics
- [ ] Can generate AI hypotheses
- [ ] All data persisted correctly
- [ ] Audit logs working

---

## Sprint 1 Metrics

**Success Criteria:**
| Metric | Target | Actual |
|--------|--------|--------|
| API response time (p95) | < 500ms | ___ |
| Auth flow completion rate | 100% | ___ |
| Prometheus query success rate | 100% | ___ |
| PagerDuty webhook processing | < 5s | ___ |
| AI hypothesis generation | < 30s | ___ |
| Test coverage | > 70% | ___ |

---

## Sprint 1 Retrospective

**Questions to answer:**
- What went well?
- What didn't go well?
- What should we change for Sprint 2?
- Any technical debt to address?
- Any scope adjustments needed?

---

## Carryover to Sprint 2

**Incomplete items (if any):**
-

**Technical debt:**
-

**New requirements discovered:**
-

---

## Next Sprint Preview

**Sprint 2 Focus: Hypothesis Engine & Slack Bot**
- Complete hypothesis confidence scoring
- Build Slack bot
- Implement incident state machine
- Create basic Slack notifications
