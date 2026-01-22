# SRE Copilot - Phase 1 Implementation Plan

## 📋 Current State vs Target Architecture

### ✅ IMPLEMENTED (Current)
- **User Interface**: React/TS frontend with dashboards, incidents, real-time WebSocket
- **API Gateway**: FastAPI with rate limiting, encryption middleware
- **Auth Layer**: JWT-based authentication with Bcrypt
- **Webhook Ingestion**: AlertManager webhook receiver
- **Incident Management**: Full CRUD with state machine
- **AI Integration**: Azure OpenAI GPT-4o-mini for hypothesis generation
- **Real-Time Updates**: WebSocket with Redis pub/sub
- **Basic Multi-Tenancy**: Tenant and User models
- **Database**: PostgreSQL with Django ORM
- **Monitoring**: Prometheus + Grafana + AlertManager

### ❌ MISSING (To Implement)

#### 1. PROJECT-BASED MULTI-TENANCY
- [ ] Project model (tenant has many projects)
- [ ] User-Project association (many-to-many)
- [ ] Project-level RBAC (owner/admin/engineer/viewer per project)
- [ ] Project switcher in frontend header
- [ ] Project-scoped incidents and data

#### 2. PULL-BASED INGESTION (Prometheus Poller)
- [ ] Prometheus poller service
- [ ] PromQL query templates
- [ ] Metric baselines and anomaly detection
- [ ] Scheduled polling (configurable intervals)
- [ ] Metric normalization

#### 3. CONTEXT ASSEMBLY ENGINE
- [ ] Context snapshots model
- [ ] Service topology tracking
- [ ] Recent changes tracking (deployments)
- [ ] Traffic baseline calculation
- [ ] Dependency health monitoring

#### 4. EVIDENCE AGGREGATION
- [ ] Signals model (normalized events)
- [ ] Temporal correlation engine
- [ ] Historical precedent matching
- [ ] Evidence scoring

#### 5. DETERMINISTIC REASONING
- [ ] Multi-factor confidence scoring
- [ ] Policy engine with rules
- [ ] Recommendations model
- [ ] Runbooks database

#### 6. DATA LAYER ENHANCEMENTS
- [ ] Integrations model (store connection configs)
- [ ] Audit logs (all actions tracked)
- [ ] Signal deduplication
- [ ] Baseline metrics storage

---

## 🎯 PHASE 1 IMPLEMENTATION ROADMAP

### MILESTONE 1: PROJECT-BASED MULTI-TENANCY (Week 1)

#### 1.1 Database Models - Projects, RBAC, Integrations
**What**: Add Project model and associations
**Why**: Enable multiple projects per tenant with granular access control

**Implementation**:
```python
# shared/models/project.py
class Project(models.Model):
    id = UUID
    tenant = ForeignKey(Tenant)
    name = CharField
    slug = SlugField
    description = TextField
    is_active = BooleanField
    created_at, updated_at = DateTimeField

class ProjectMember(models.Model):
    project = ForeignKey(Project)
    user = ForeignKey(User)
    role = CharField  # owner, admin, engineer, viewer
    created_at = DateTimeField

class Integration(models.Model):
    project = ForeignKey(Project)
    integration_type = CharField  # prometheus, grafana, etc
    name = CharField
    config = JSONField  # encrypted connection details
    is_active = BooleanField
```

**Files to modify**:
- Create: `shared/models/project.py`
- Update: `shared/models/incident.py` (add project FK)
- Update: `shared/models/__init__.py`
- Migrations: `python manage.py makemigrations`

---

#### 1.2 Auth Service - Project Context
**What**: Update JWT to include project context
**Why**: API calls need project-scoped data

**Implementation**:
- JWT payload: `{user_id, tenant_id, project_id, role}`
- Login endpoint: return user's projects list
- Project switch endpoint: `/api/v1/auth/switch-project`

**Files to modify**:
- `services/auth-service/app/api/auth.py`
- `services/auth-service/app/services/jwt_service.py`

---

#### 1.3 API Gateway - Project Middleware
**What**: Extract project_id from JWT, inject into requests
**Why**: All downstream services need project context

**Implementation**:
```python
# Add to API Gateway middleware
async def project_context_middleware(request, call_next):
    project_id = request.state.project_id  # from JWT
    # Inject into all proxied requests
```

**Files to modify**:
- `services/api-gateway/app/middleware/auth_middleware.py` (new)

---

#### 1.4 Frontend - Project Switcher
**What**: Header dropdown to switch active project
**Why**: Users need to navigate between projects

**Implementation**:
- Add `ProjectSwitcher` component in header
- Store `currentProject` in zustand
- API call to `/auth/switch-project`
- Reload data when project changes

**Files to create**:
- `frontend/src/components/layout/ProjectSwitcher.tsx`
- `frontend/src/lib/stores/project-store.ts`

**Files to modify**:
- `frontend/src/components/layout/Header.tsx`

---

### MILESTONE 2: PULL-BASED PROMETHEUS INTEGRATION (Week 2)

#### 2.1 Prometheus Poller Service
**What**: New microservice to poll Prometheus metrics
**Why**: Pull-based ingestion for proactive monitoring

**Implementation**:
```
services/
  prometheus-poller/
    app/
      api/
        health.py
        integrations.py  # CRUD for prometheus configs
      services/
        poller.py  # Main polling loop
        promql_templates.py  # Query templates
        metric_normalizer.py
      models/
        metric_baseline.py
    Dockerfile
    requirements.txt
```

**Polling Logic**:
- Cron-based (every 1min for critical, 5min for others)
- Query PromQL templates
- Normalize metrics to Signal model
- Compare against baseline
- Publish anomalies to incident service

**Files to create**: Entire new service

---

#### 2.2 Signal Model and Normalization
**What**: Universal signal format for all ingestion sources
**Why**: Consistent processing pipeline

**Implementation**:
```python
class Signal(models.Model):
    project = ForeignKey(Project)
    signal_type = CharField  # alert, metric, log, trace
    source = CharField  # prometheus, alertmanager, etc
    severity = CharField
    title, description = TextField
    raw_data = JSONField
    normalized_data = JSONField
    hash = CharField  # for deduplication
    created_at = DateTimeField
```

**Files to create**:
- `shared/models/signal.py`
- `services/ingestion-service/app/services/normalizer.py`

---

#### 2.3 Integration Management UI
**What**: Frontend CRUD for Prometheus connections
**Why**: Users configure their own Prometheus instances

**Implementation**:
- Settings page → Integrations tab
- Add/Edit/Delete Prometheus configs
- Test connection button
- Encrypted storage of credentials

**Files to create**:
- `frontend/src/pages/IntegrationsPage.tsx`
- `frontend/src/components/integrations/PrometheusForm.tsx`

---

### MILESTONE 3: CONTEXT ASSEMBLY & EVIDENCE (Week 3)

#### 3.1 Context Snapshots
**What**: Capture immutable state snapshot when incident detected
**Why**: Required for hypothesis generation

**Implementation**:
```python
class ContextSnapshot(models.Model):
    incident = OneToOneField(Incident)
    service_topology = JSONField
    recent_deployments = JSONField
    traffic_baseline = JSONField
    dependency_health = JSONField
    slo_state = JSONField
    correlated_signals = JSONField
    created_at = DateTimeField
```

**Snapshot Builder**:
1. When incident created → trigger snapshot
2. Query metrics from last 24h
3. Query deployments (GitHub API)
4. Calculate baselines
5. Find correlated signals (time window ±5min)

**Files to create**:
- `shared/models/context.py`
- `services/context-service/` (new microservice)

---

#### 3.2 Evidence Aggregator
**What**: Score and rank evidence for hypotheses
**Why**: Deterministic confidence scoring needs evidence

**Implementation**:
- Temporal correlation (deployment → error spike)
- Historical precedents (similar incidents)
- Signal strength (3σ vs baseline)
- Multi-source validation

**Files to create**:
- `services/reasoning-service/app/services/evidence_aggregator.py`

---

### MILESTONE 4: DETERMINISTIC REASONING ENGINE (Week 4)

#### 4.1 Confidence Scoring Model
**What**: Multi-factor scoring (not just LLM intuition)
**Why**: Explainable AI with confidence breakdown

**Implementation**:
```python
def calculate_confidence(hypothesis, evidence, context):
    factors = {
        'signal_strength': 0.25 * score_signal_strength(evidence),
        'temporal_correlation': 0.20 * score_temporal(evidence),
        'precedent_frequency': 0.20 * score_precedents(hypothesis),
        'evidence_quality': 0.20 * score_evidence_quality(evidence),
        'human_validation': 0.15 * score_historical_feedback(hypothesis)
    }
    confidence = sum(factors.values())
    return confidence, factors  # Return breakdown
```

**Files to create**:
- `services/reasoning-service/app/services/confidence_scorer.py`

---

#### 4.2 Policy Engine
**What**: Rule-based decision making
**Why**: Define when to auto-ack, request human input, etc

**Implementation**:
```python
class Policy(models.Model):
    project = ForeignKey(Project)
    name = CharField
    rules = JSONField
    is_active = BooleanField

# Example rule
{
  "condition": "confidence > 0.85 AND precedent_exists",
  "action": "auto_acknowledge"
}
```

**Files to create**:
- `shared/models/policy.py`
- `services/reasoning-service/app/services/policy_engine.py`

---

#### 4.3 Runbooks & Recommendations
**What**: Store runbooks, match to incidents
**Why**: Actionable recommendations for incidents

**Implementation**:
```python
class Runbook(models.Model):
    project = ForeignKey(Project)
    title = CharField
    description = TextField
    steps = JSONField
    tags = ArrayField
    embedding = Vector  # For semantic search

class Recommendation(models.Model):
    incident = ForeignKey(Incident)
    hypothesis = ForeignKey(Hypothesis)
    runbook = ForeignKey(Runbook, null=True)
    action_type = CharField
    parameters = JSONField
    risk_level = CharField
    estimated_mttr = IntegerField
    rank = IntegerField
```

**Files to create**:
- `shared/models/runbook.py`
- `services/reasoning-service/app/services/recommendation_engine.py`

---

### MILESTONE 5: AUDIT & OBSERVABILITY (Week 5)

#### 5.1 Audit Logs
**What**: Immutable log of all actions
**Why**: Compliance, debugging, trust

**Implementation**:
```python
class AuditLog(models.Model):
    project = ForeignKey(Project)
    user = ForeignKey(User, null=True)
    action = CharField  # incident.created, hypothesis.accepted, etc
    resource_type = CharField
    resource_id = UUIDField
    details = JSONField
    ip_address = GenericIPAddressField
    created_at = DateTimeField
```

**Files to create**:
- `shared/models/audit.py`
- `services/audit-service/app/api/audit.py`

---

#### 5.2 Metrics & Monitoring
**What**: Dogfood the system - monitor itself
**Why**: Track performance, costs, effectiveness

**Metrics to track**:
- Signals per second (by source, type)
- Processing latency (p50, p95, p99)
- Queue depth
- LLM token usage & cost
- Hypothesis precision/recall
- MTTR reduction

**Files to modify**:
- Add metrics to all services
- Prometheus exporters

---

## 🏗️ IMPLEMENTATION ORDER

### Week 1: Foundation
1. Create Project, ProjectMember, Integration models
2. Run migrations
3. Update auth service (JWT with project_id)
4. Add project middleware to API gateway
5. Build frontend ProjectSwitcher component
6. Test multi-project flow

### Week 2: Ingestion
1. Create Signal model
2. Build prometheus-poller service
3. Implement metric normalization
4. Build integrations management UI
5. Test pull-based polling

### Week 3: Context
1. Create ContextSnapshot model
2. Build context-service
3. Implement evidence aggregator
4. Test snapshot generation

### Week 4: Reasoning
1. Implement confidence scoring
2. Build policy engine
3. Create Runbook model
4. Build recommendation engine
5. Update AI service to use evidence

### Week 5: Audit
1. Create AuditLog model
2. Add audit middleware to all services
3. Build audit log viewer UI
4. Add metrics exporters

---

## 🔄 DATA FLOW (After Phase 1)

```
1. User logs in → Select project
2. Prometheus poller → Query metrics → Normalize to Signal
3. Signal → Anomaly detection → Create Incident
4. Incident → Trigger context snapshot
5. Context + Evidence → LLM hypothesis generation
6. Hypotheses → Deterministic confidence scoring
7. Scored hypotheses → Policy engine evaluation
8. Policy result → Recommendations + Runbooks
9. WebSocket → Push updates to frontend
10. All actions → Audit log
```

---

## 📦 NEW SERVICES TO CREATE

1. **prometheus-poller** - Pull-based metric ingestion
2. **context-service** - Context snapshot generation
3. **reasoning-service** - Evidence + Scoring + Policy + Recommendations
4. **(optional) ingestion-service** - Unified signal normalization

---

## 🗂️ DATABASE SCHEMA ADDITIONS

**New Tables**:
- `projects` - Project entity
- `project_members` - User-Project associations with roles
- `integrations` - Connection configs
- `signals` - Normalized events
- `context_snapshots` - Incident context
- `policies` - Rule definitions
- `runbooks` - Remediation guides
- `recommendations` - Actionable suggestions
- `audit_logs` - Immutable action log

**Modified Tables**:
- `incidents` - Add `project_id` FK
- `hypotheses` - Add evidence reference

---

## 🎨 FRONTEND ADDITIONS

**New Components**:
- `ProjectSwitcher.tsx` - Header dropdown
- `IntegrationsPage.tsx` - Integration management
- `AuditLogPage.tsx` - Audit trail viewer
- `RunbooksPage.tsx` - Runbook CRUD
- `PolicyEditor.tsx` - Policy rule builder
- `ConfidenceBreakdown.tsx` - Show scoring factors

**New Stores**:
- `project-store.ts` - Current project context
- `integrations-store.ts` - Integration configs

---

## ⚙️ CONFIGURATION CHANGES

**Environment Variables** (add to .env):
```bash
# Prometheus Polling
PROMETHEUS_POLL_INTERVAL=60
PROMETHEUS_DEFAULT_QUERIES=./config/promql_templates.yaml

# AI Service (Already using GPT)
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Vector DB (Future)
PINECONE_API_KEY=...
PINECONE_INDEX=sre-copilot-runbooks
```

---

## 🚀 QUICK START (After Implementation)

1. **Add Project**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/projects \
     -H "Authorization: Bearer $TOKEN" \
     -d '{"name": "Production", "description": "Main prod project"}'
   ```

2. **Add Prometheus Integration**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/integrations \
     -H "Authorization: Bearer $TOKEN" \
     -d '{
       "project_id": "...",
       "type": "prometheus",
       "config": {"url": "http://prometheus:9090"}
     }'
   ```

3. **Switch Project in UI**:
   - Click project dropdown in header
   - Select "Production"
   - All data now scoped to that project

---

## 📊 SUCCESS METRICS

After Phase 1 completion:
- ✅ Users can manage multiple projects
- ✅ RBAC works at project level
- ✅ Prometheus metrics ingested automatically
- ✅ Context snapshots generated for incidents
- ✅ Multi-factor confidence scores displayed
- ✅ Policy engine auto-acknowledges high-confidence incidents
- ✅ Runbook recommendations shown
- ✅ All actions audited

---

## 🔜 PHASE 2 PREVIEW

- Anomaly detection ML models
- Forecasting (Prophet)
- Vector DB for semantic runbook search
- Slack/Teams bot integration
- Advanced visualization
- Correlation engine

