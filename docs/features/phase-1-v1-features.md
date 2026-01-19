# Phase 1 - V1 Feature Specifications
## SRE Copilot Intelligence Layer

**Timeline:** Months 1-4 (16 weeks)
**Goal:** Earn trust through incident sensemaking
**Success Metric:** 60% of incidents start with "asking the AI"

---

## Core Features

### 1. Incident Context Assistant

**Description:**
AI-powered assistant that provides real-time context and analysis when incidents occur.

**User Stories:**
- As an on-call engineer, when I receive a PagerDuty alert, I want to immediately understand what's happening without manually correlating metrics, logs, and recent changes
- As an SRE, I want to see what changed recently that might have caused this issue
- As a team lead, I want to know if we've seen similar incidents before and how we resolved them

**Technical Requirements:**
- Real-time signal ingestion from PagerDuty and Prometheus
- Context snapshot generation within 30 seconds of alert
- Display in Slack within 60 seconds of alert trigger

**Acceptance Criteria:**
- [ ] Receives PagerDuty webhooks and processes within 5 seconds
- [ ] Generates context snapshot including:
  - Service topology (upstream/downstream dependencies)
  - Recent deployments (last 24 hours)
  - Traffic baseline comparisons
  - Related alerts in the same time window
  - Similar historical incidents (if any)
- [ ] Posts formatted message to Slack channel
- [ ] Response time p95 < 60 seconds end-to-end

**UI/UX:**
```
🚨 CRITICAL ALERT: payment-api
───────────────────────────────────────
Service: payment-api (prod)
Metric: p99 latency > 5000ms (threshold: 1000ms)
Started: 2026-01-19 10:35:42 UTC (5 minutes ago)

📊 CONTEXT:
• Traffic: 1,234 req/s (↑ 15% vs 7-day avg)
• Error rate: 0.8% (baseline: 0.1%)
• Deployment: v2.4.5 deployed 12 minutes ago

🔗 DEPENDENCIES:
• ✅ postgres-primary: healthy
• ⚠️ redis-cache: elevated response time (+40%)
• ✅ billing-api: healthy

💡 ANALYZING...
```

**Out of Scope for V1:**
- Custom dashboards (basic Slack only)
- Multi-channel routing (single Slack channel only)
- Mobile notifications

---

### 2. Hypothesis Generation Engine

**Description:**
Automatically generates 3-5 ranked hypotheses about incident root causes based on evidence.

**User Stories:**
- As an on-call engineer, I want AI to suggest what might be wrong so I can investigate systematically rather than guessing
- As an SRE, I want to see confidence levels so I know which hypotheses to prioritize
- As a manager, I want to understand the reasoning behind each hypothesis

**Technical Requirements:**
- Claude API integration for hypothesis generation
- Multi-factor confidence scoring (signal strength, temporal correlation, precedent, evidence quality)
- Evidence linking (each hypothesis must cite specific evidence)
- Hypothesis ranking and deduplication

**Acceptance Criteria:**
- [ ] Generates 3-10 hypothesis candidates using LLM
- [ ] Scores each hypothesis using deterministic multi-factor model:
  - Signal strength (0.25 weight)
  - Temporal correlation (0.20 weight)
  - Precedent frequency (0.20 weight)
  - Evidence quality (0.20 weight)
  - Human validation history (0.15 weight)
- [ ] Filters to top 3-5 hypotheses with confidence > 0.4
- [ ] Each hypothesis includes:
  - Clear claim statement
  - Confidence range [lower, upper]
  - Supporting evidence (with links/references)
  - Contradicting evidence (if any)
  - Similar historical incidents (if any)
- [ ] Presents hypotheses ranked by confidence
- [ ] Allows user feedback (accept/reject/add evidence)

**UI/UX:**
```
💡 TOP HYPOTHESES:

1. Recent deployment causing downstream timeout (confidence: 0.72-0.85)
   ├─ ✅ Deployment v2.4.5 completed 10min before symptoms
   ├─ ✅ redis-cache response time increased +40%
   ├─ ✅ Similar incident on 2025-12-03 (INC-445)
   └─ ⚠️ No error logs in payment-api (unexpected)

   💬 Feedback: [✓ Accurate] [✗ Incorrect] [+ Add Evidence]

2. Redis connection pool exhaustion (confidence: 0.58-0.71)
   ├─ ✅ Redis response time degraded
   ├─ ✅ Traffic spike +15% above baseline
   └─ ❓ No connection pool metrics available

   💬 Feedback: [✓ Accurate] [✗ Incorrect] [+ Add Evidence]

3. Database query regression in new code (confidence: 0.45-0.62)
   ├─ ✅ Deployment timing matches
   ├─ ❓ No slow query logs (yet)
   └─ ❌ Database metrics show normal performance

   💬 Feedback: [✓ Accurate] [✗ Incorrect] [+ Add Evidence]
```

**Out of Scope for V1:**
- Custom hypothesis from user (can only accept/reject AI suggestions)
- Real-time hypothesis refinement as new evidence arrives
- Multi-hypothesis testing automation

---

### 3. Runbook Recommendation System

**Description:**
Semantic search over runbook corpus to suggest relevant remediation procedures.

**User Stories:**
- As a junior engineer, I want to quickly find the right runbook without knowing what it's called
- As an on-call engineer, I want runbooks ranked by relevance to my current incident
- As an SRE, I want to see runbooks that worked for similar past incidents

**Technical Requirements:**
- Runbook corpus in Pinecone (vector database)
- Semantic search using text embeddings
- Integration with hypothesis engine (recommend runbooks per hypothesis)
- Runbook versioning and metadata

**Acceptance Criteria:**
- [ ] Runbooks stored in Pinecone with metadata:
  - Service applicability
  - Risk level (low/medium/high)
  - Average execution time
  - Success rate (from historical usage)
- [ ] Search query combines:
  - Incident symptoms
  - Service name
  - Top hypothesis
- [ ] Returns top 3-5 runbooks ranked by semantic similarity
- [ ] Each result shows:
  - Runbook title
  - Relevance score
  - Risk level
  - Estimated time
  - Link to full runbook
- [ ] Tracks which runbooks were used (for future ranking)

**UI/UX:**
```
📖 RECOMMENDED RUNBOOKS:

For hypothesis: "Recent deployment causing downstream timeout"

1. ⭐ Rollback Recent Deployment (relevance: 0.91)
   Risk: Low | Time: ~5 min | Success rate: 94%
   Used in 12 similar incidents
   [View Runbook] [Mark as Used]

2. ⭐ Restart Redis Connection Pool (relevance: 0.78)
   Risk: Medium | Time: ~3 min | Success rate: 87%
   Used in 8 similar incidents
   [View Runbook] [Mark as Used]

3. Scale Payment API Replicas (relevance: 0.65)
   Risk: Low | Time: ~2 min | Success rate: 76%
   Used in 5 similar incidents
   [View Runbook] [Mark as Used]
```

**Out of Scope for V1:**
- Runbook execution automation (Phase 3)
- Runbook editing via UI (manual Git updates only)
- Dynamic runbook generation

---

### 4. Root Cause Analysis Assistant

**Description:**
Helps engineers conduct thorough RCA by maintaining investigation timeline and evidence trail.

**User Stories:**
- As an on-call engineer, I want the system to remember what I've checked and what I found
- As an incident commander, I want to see the investigation timeline in real-time
- As an SRE writing a post-mortem, I want a complete evidence trail

**Technical Requirements:**
- Incident state machine (DETECTED → INVESTIGATING → MITIGATED → RESOLVED → LEARNED)
- Timeline reconstruction from all signals and user actions
- Evidence aggregation (metrics, logs, traces, user observations)
- Integration with Slack for conversational investigation

**Acceptance Criteria:**
- [ ] Incident state transitions logged with timestamps
- [ ] Timeline includes:
  - Initial alert trigger
  - Hypothesis generation
  - User investigations (what they checked)
  - Runbook executions
  - Mitigation actions
  - Resolution
- [ ] Natural language queries via Slack:
  - "What happened between 10:30 and 10:45?"
  - "Show me all redis metrics for this incident"
  - "Did we deploy anything before this started?"
- [ ] Responses include relevant timeline events with evidence
- [ ] All interactions saved for post-mortem generation

**UI/UX:**
```
User: "What happened between 10:30 and 10:45?"

🔍 INCIDENT TIMELINE (10:30-10:45 UTC)

10:32:15 - 🚀 Deployment: payment-api v2.4.5 deployed
           └─ Commit: abc123f "Optimize Redis connection handling"

10:35:42 - 🚨 Alert triggered: p99 latency > 5000ms
           └─ Baseline: 250ms → Current: 5,847ms

10:36:05 - 📊 Correlated metric: redis response time +40%
           └─ Baseline: 5ms → Current: 7ms

10:38:22 - 👤 User checked: Redis connection pool metrics
           └─ Result: Pool utilization 45% (normal)

10:40:11 - 📖 Runbook suggested: "Rollback Recent Deployment"

10:42:30 - 👤 User executed: Rollback to v2.4.4
           └─ Status: In progress...

10:45:00 - ✅ Metrics recovering: p99 latency → 320ms
```

**Out of Scope for V1:**
- Automated RCA report generation (basic only in V1)
- Cross-incident correlation
- Predictive incident detection

---

### 5. Post-Mortem Auto-Generation

**Description:**
Generates draft post-mortem document from incident timeline and evidence.

**User Stories:**
- As an SRE, I want a draft post-mortem so I don't start from a blank page
- As an incident commander, I want key facts auto-populated (timeline, impact, resolution)
- As a manager, I want consistent post-mortem format across all incidents

**Technical Requirements:**
- Template-based generation using incident data
- Claude API for narrative generation
- Markdown output compatible with GitHub/Confluence
- Human editing workflow (draft → review → publish)

**Acceptance Criteria:**
- [ ] Generates post-mortem draft when incident state = RESOLVED
- [ ] Includes sections:
  - **Summary**: 2-3 sentence overview
  - **Impact**: Affected services, duration, user impact
  - **Timeline**: Key events from investigation
  - **Root Cause**: Top hypothesis with evidence
  - **Resolution**: Actions taken
  - **Action Items**: TODO list (empty, for human to fill)
- [ ] Written in clear, concise prose (not robotic)
- [ ] Includes links to:
  - Slack thread
  - Alert definition
  - Runbooks used
  - Metrics dashboards
  - Relevant commits
- [ ] Posted to Slack as draft for review
- [ ] Supports export to Markdown/Confluence

**UI/UX:**
```
📝 POST-MORTEM DRAFT READY

Incident: INC-789 - Payment API Latency Spike
Duration: 19 Jan 2026 10:35 - 10:52 UTC (17 minutes)

# Incident Post-Mortem: Payment API Latency Spike

## Summary
On January 19, 2026, the payment-api service experienced elevated p99 latency
(5,000ms+) for 17 minutes following a deployment. The issue was caused by a
Redis connection handling bug introduced in v2.4.5. The incident was mitigated
by rolling back to v2.4.4.

## Impact
- **Services Affected**: payment-api (prod)
- **Duration**: 17 minutes (10:35 - 10:52 UTC)
- **User Impact**: ~230 checkout timeouts, ~$15K in failed transactions
- **SLO Impact**: Availability SLO breached (99.5% → 99.2%)

## Timeline
- **10:32 UTC**: Deployment of payment-api v2.4.5 completed
- **10:35 UTC**: Alert triggered for p99 latency > 5000ms
- **10:36 UTC**: Correlated redis response time increase (+40%)
- **10:40 UTC**: Hypothesis: Deployment caused downstream timeout
- **10:42 UTC**: Rollback to v2.4.4 initiated
- **10:52 UTC**: Metrics returned to normal

[Full timeline with evidence ↗]

## Root Cause
... [Claude-generated explanation] ...

## Resolution
... [Actions taken] ...

## Action Items
[ ] TODO: Add items during review

---
[Edit Draft] [Approve & Publish] [Discard]
```

**Out of Scope for V1:**
- Automated action item generation
- Post-mortem templates per team
- Integration with post-mortem tracking tools

---

### 6. Slack Bot Interface

**Description:**
Primary user interface via Slack for incident management and investigation.

**User Stories:**
- As an on-call engineer, I want to interact with the system without leaving Slack
- As an SRE, I want natural language queries, not command syntax
- As a team, we want incident threads to keep all context in one place

**Technical Requirements:**
- Slack App with Bot User
- OAuth 2.0 for workspace installation
- Slack Events API for real-time interactions
- Thread-based conversations (one thread per incident)
- Interactive components (buttons, dropdowns)

**Acceptance Criteria:**
- [ ] Slack app installable via OAuth
- [ ] Bot commands:
  - `/sre status <service>` - Current service health
  - `/sre incidents` - List active incidents
  - `/sre incident <id>` - Incident details
  - Natural language (no slash command required in thread)
- [ ] Automatic incident thread creation on alert
- [ ] Interactive elements:
  - Buttons for hypothesis feedback
  - Dropdowns for runbook selection
  - Confirmation dialogs for actions
- [ ] Mentions and notifications:
  - @mentions on-call engineer
  - Thread updates on hypothesis/resolution
  - DM for critical alerts (optional)
- [ ] Supports emoji reactions for quick feedback

**UI/UX:**
```
[Slack Thread]

SRE Copilot BOT  10:35 AM
🚨 CRITICAL ALERT: payment-api
[Context snapshot as shown above...]
💡 ANALYZING...

SRE Copilot BOT  10:36 AM
💡 TOP HYPOTHESES:
[Hypotheses as shown above...]

@alice (on-call)

Alice  10:38 AM
What were the redis metrics at 10:35?

SRE Copilot BOT  10:38 AM
📊 Redis Metrics at 10:35 UTC:
• Response time: 7ms (↑40% vs baseline 5ms)
• Connection pool: 45% utilized (normal)
• Memory: 2.1GB / 4GB (normal)
• Commands/sec: 3,450 (↑12% vs baseline)

Alice  10:40 AM
/sre runbook redis timeout

SRE Copilot BOT  10:40 AM
📖 RECOMMENDED RUNBOOKS:
[Runbooks as shown above...]

Alice  10:42 AM
:white_check_mark: [reacts to hypothesis #1]

SRE Copilot BOT  10:42 AM
✅ Hypothesis marked as accurate. Updating confidence model.
```

**Out of Scope for V1:**
- Microsoft Teams support (Slack only)
- Discord support
- Multi-workspace support (one workspace per tenant)
- Custom slash commands per team

---

## Technical Foundation Features

### 7. Multi-Tenant Architecture

**Description:**
Support multiple customers (tenants) with complete data isolation.

**Technical Requirements:**
- Tenant isolation at database level (PostgreSQL schemas or row-level security)
- Tenant context injection at API gateway
- Separate Slack workspace per tenant
- Separate integration credentials per tenant

**Acceptance Criteria:**
- [ ] Each tenant has isolated:
  - Database schema (or RLS policies)
  - Slack workspace
  - Integration configs
  - API keys
- [ ] Tenant ID derived from:
  - API key (for API calls)
  - Slack workspace ID (for Slack events)
- [ ] No data leakage between tenants (security tested)
- [ ] Performance: tenant isolation adds <10ms latency

---

### 8. Integration Framework

**Description:**
Pluggable integration system for observability tools and incident management platforms.

**Technical Requirements:**
- Abstract integration interface
- OAuth 2.0 support for integrations
- Webhook receiver for push integrations
- Polling scheduler for pull integrations
- Integration health checks

**Phase 1 Integrations (MVP):**
- **Prometheus** (metrics) - Pull-based polling
- **PagerDuty** (incidents) - Webhook-based

**Acceptance Criteria:**
- [ ] Prometheus integration:
  - Configure Prometheus endpoint + credentials
  - Query metrics via PromQL
  - Test connection (health check)
  - Poll interval: 30 seconds
- [ ] PagerDuty integration:
  - Configure webhook URL
  - Receive incident webhooks
  - Parse incident data
  - Map to internal incident model
- [ ] Integration status dashboard (admin only):
  - Last successful sync
  - Error count
  - Health status (healthy/degraded/down)

**Out of Scope for V1:**
- Datadog, Grafana, New Relic (Phase 2)
- Custom integrations API
- Integration marketplace

---

### 9. Authentication & Authorization

**Description:**
Secure user authentication and role-based access control.

**Technical Requirements:**
- Azure AD SSO (primary auth method)
- JWT-based API authentication
- RBAC with predefined roles
- Audit logging for all auth events

**Roles:**
- **Admin**: Full access, can manage integrations and users
- **Engineer**: Can investigate incidents, provide feedback, view all data
- **Viewer**: Read-only access to incidents and dashboards

**Acceptance Criteria:**
- [ ] Azure AD SSO login flow
- [ ] JWT token generation with 1-hour expiry
- [ ] Refresh token support
- [ ] RBAC enforcement at API level:
  - Admins can manage integrations
  - Engineers can provide feedback
  - Viewers can only read
- [ ] Audit log captures:
  - Login/logout events
  - Permission changes
  - Integration modifications

**Out of Scope for V1:**
- Custom auth providers (Azure AD only)
- SSO with SAML
- API key management for external services

---

### 10. Audit Trail & Compliance

**Description:**
Comprehensive audit logging for compliance and debugging.

**Technical Requirements:**
- Immutable audit log (append-only)
- Structured logging format (JSON)
- Retention policy (3 years default)
- Query interface for audit logs

**Logged Events:**
- All API calls (endpoint, user, timestamp, response code)
- All AI decisions (hypothesis generation, confidence scores, evidence)
- All user feedback (hypothesis accept/reject, runbook usage)
- All integrations (sync events, errors)
- All auth events (login, logout, permission changes)

**Acceptance Criteria:**
- [ ] PostgreSQL table for audit logs (append-only)
- [ ] Log entry structure:
  ```json
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "timestamp": "ISO8601",
    "event_type": "api_call|ai_decision|user_feedback|...",
    "user_id": "uuid",
    "resource_type": "incident|hypothesis|integration|...",
    "resource_id": "uuid",
    "action": "create|update|delete|view",
    "details": { ... },
    "ip_address": "string",
    "user_agent": "string"
  }
  ```
- [ ] Admin interface to query audit logs:
  - Filter by date range, user, event type
  - Export to CSV
- [ ] Retention policy enforced automatically

---

## Non-Functional Requirements

### Performance
- **API Response Time**: p95 < 500ms
- **Slack Response Time**: p95 < 60s (including AI processing)
- **Incident Processing**: Alert → Hypothesis in < 2 minutes
- **Concurrent Incidents**: Handle 10 simultaneous incidents per tenant

### Reliability
- **Uptime SLA**: 99.5% (Phase 1, best-effort)
- **Data Durability**: No data loss (PostgreSQL with backups)
- **Graceful Degradation**: If LLM unavailable, still show context snapshot

### Security
- **Data Encryption**: At-rest (database encryption) and in-transit (TLS 1.3)
- **Secret Management**: Azure Key Vault for credentials
- **Vulnerability Scanning**: Weekly dependency scans
- **Compliance**: SOC2 Type I ready (audit in Year 2)

### Scalability
- **Tenants**: Support 10-20 tenants in Phase 1
- **Incidents per Tenant**: 100 incidents/month per tenant
- **Data Retention**: 1 year hot data, 3 years total

---

## Out of Scope for Phase 1

### Explicitly NOT Included:
- ❌ Custom dashboards (Slack only)
- ❌ Automated remediation (Phase 3)
- ❌ Predictive alerting (Phase 2)
- ❌ Multi-cloud cost optimization (Phase 3)
- ❌ Mobile app
- ❌ Public API for third-party integrations
- ❌ White-label / on-premise deployment
- ❌ Integrations beyond Prometheus + PagerDuty
- ❌ Advanced analytics / BI dashboards
- ❌ Real-time collaboration features (beyond Slack threads)

---

## Success Metrics (Phase 1 Evaluation)

After 16 weeks, we will measure:

| Metric | Target | How We Measure |
|--------|--------|----------------|
| **Adoption** | 60%+ engineers use it weekly | Slack bot engagement metrics |
| **Trust** | 70%+ hypotheses marked accurate | Feedback acceptance rate |
| **MTTR Reduction** | 30% faster incident resolution | Compare: Time(alert→resolution) before/after |
| **User Satisfaction** | NPS > 40 | Survey beta users |
| **Technical Reliability** | 99%+ uptime | System monitoring |
| **Cost per Tenant** | < $500/month | Claude API + infra costs |

**Gate 1 Decision (Week 8):**
If 3+ beta users ask AI before Slack → Continue Phase 1
If not → Pivot UX or messaging

**Gate 2 Decision (Week 16):**
If 5+ customers willing to pay → Build Phase 2
If not → Improve Phase 1 or pivot

---

## Dependencies & Prerequisites

### External Services Required:
- Azure AD tenant (for SSO)
- Claude API key (Anthropic)
- Pinecone account (vector database)
- Slack workspace (for bot testing)
- PagerDuty account (for integration testing)
- Prometheus instance (for metrics testing)

### Infrastructure:
- Azure subscription
- Kubernetes cluster (AKS recommended)
- PostgreSQL database (Azure Database for PostgreSQL)
- Redis instance (Azure Cache for Redis)
- Docker registry (Azure Container Registry)

---

## Delivery Timeline

See `sprints/phase-1/` folder for detailed sprint plans.

**Summary:**
- **Weeks 1-4**: Foundation (DB, auth, integrations)
- **Weeks 5-8**: Core engine (context, hypotheses, Slack bot)
- **Weeks 9-12**: Features (runbooks, RCA, post-mortems)
- **Weeks 13-16**: Polish + beta customer deployment
