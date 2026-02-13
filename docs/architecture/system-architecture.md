# SRE Copilot -- System Architecture

---

## Overview

SRE Copilot is a multi-tenant SaaS observability and incident intelligence platform built on a microservices architecture with 14 backend services. It collects metrics, logs, traces, and errors from customer systems, provides AI-powered incident analysis, and delivers real-time dashboards.

---

## Architecture Diagram

```
                         ┌─────────────────────────────────┐
                         │     External Systems / Agents    │
                         │  (Prometheus, Infra Agent, SDK)  │
                         └───────────────┬─────────────────┘
                                         │ API Key Auth
                                         ▼
┌──────────────┐              ┌──────────────────────┐
│   Frontend   │◀────WS──────│   WebSocket Service   │
│   (React)    │              │       :8505           │
│   :3000      │              └──────────┬───────────┘
└──────┬───────┘                         │ Redis Pub/Sub
       │ HTTP                            │
       ▼                                 │
┌──────────────────────────────────────────────────────────┐
│                      API Gateway                          │
│                        :8580                              │
│  JWT Auth  |  Rate Limiting  |  CORS  |  Request Routing  │
└──────┬──────────┬──────────┬──────────┬──────────────────┘
       │          │          │          │
  ┌────┴───┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────────────────┐
  │  Auth  │ │Incident│ │   AI   │ │  Integration       │
  │ :8501  │ │ :8502  │ │ :8503  │ │  :8504             │
  └────────┘ └────────┘ └────────┘ └────────────────────┘
       │          │          │
  ┌────┴──────────┴──────────┴──────────────────────────┐
  │              Observability Services                   │
  │                                                       │
  │  Metrics Collector :8509   Log Service :8510          │
  │  Alerting :8511            Synthetic :8512            │
  │  Security :8513            Cloud Connector :8514      │
  │  CI/CD Connector :8515     Audit :8508                │
  └──────────────────────┬────────────────────────────────┘
                         │
              ┌──────────┴──────────┐
              │   PostgreSQL (ext)  │
              │   Redis (container) │
              └─────────────────────┘
```

---

## Core Services

### 1. API Gateway (:8500, external :8580)

Central entry point for all API requests.

**Responsibilities:**
- JWT token verification (delegates to Auth Service for token generation)
- Route requests to the correct backend service
- Extract `project_id` from authenticated user context and inject into downstream requests
- Public data ingest API with API-key authentication
- Rate limiting, CORS, request logging

**Key files:**
- `app/api/proxy.py` -- Auth, incident, AI proxy routes
- `app/api/observability_proxy.py` -- Metrics, logs, alerts, synthetic, security, CI/CD, cloud routes
- `app/api/ingest_proxy.py` -- Public ingest endpoints (API-key auth)
- `app/core/config.py` -- All service URLs and settings

---

### 2. Auth Service (:8501)

User authentication and tenant management.

**Responsibilities:**
- User registration and login
- JWT access token (15 min) + refresh token (7 days) in httpOnly cookies
- Multi-tenant management (Tenant, Project, ProjectMember)
- RBAC roles: Owner, Admin, Engineer, Viewer
- API key generation for data ingest
- Monitoring integration management (Prometheus/Grafana URLs)

**Key models:** Tenant, User, Project, ProjectMember, MonitoringIntegration, APIKey

---

### 3. Incident Service (:8502)

Incident lifecycle management.

**Responsibilities:**
- Incident CRUD
- State machine: DETECTED -> ACKNOWLEDGED -> INVESTIGATING -> MITIGATED -> RESOLVED -> LEARNED
- Triggers AI hypothesis generation
- Workflow / analysis step tracking
- Real-time updates via Redis Pub/Sub

**Key models:** Incident, Hypothesis, AnalysisStep

---

### 4. AI Service (:8503)

AI-powered hypothesis generation using Azure OpenAI GPT-4o-mini.

**Responsibilities:**
- Generate 3-5 root cause hypotheses per incident
- Confidence scoring and evidence aggregation
- Response caching (database + Redis locking)
- Token usage and cost tracking / analytics

**Key models:** AIRequest

---

### 5. Integration Service (:8504)

External tool integrations.

**Responsibilities:**
- Prometheus AlertManager webhook receiver
- Convert alerts into incidents
- Integration health monitoring

---

### 6. WebSocket Service (:8505)

Real-time bidirectional communication.

**Responsibilities:**
- WebSocket connections authenticated via JWT
- Redis Pub/Sub subscriber -- broadcasts events to connected clients
- Tenant-isolated channels
- Heartbeat / keep-alive with auto-reconnect support

**Event types:** `incident.created`, `incident.updated`, `hypothesis.generated`, `alert.fired`

---

### 7. Audit Service (:8508)

API audit logging for compliance.

**Responsibilities:**
- Log all API operations
- User action tracking
- Resource change history (before/after snapshots)
- Audit statistics and retention

---

### 8. Metrics Collector Service (:8509)

The largest backend service -- handles all observability data ingestion and querying.

**Responsibilities:**
- Metrics ingestion and query (time-series)
- Distributed traces
- Error tracking
- Infrastructure data
- Browser performance data
- Dashboard management
- SLO / SLI tracking
- Deployment tracking
- Service registry

**Key models:** MetricDataPoint, TraceSpan, ErrorEvent, InfrastructureData, BrowserPerformance, Dashboard, SLO, Deployment, ServiceInfo

---

### 9. Log Service (:8510)

Centralized log management.

**Responsibilities:**
- Log ingestion (bulk)
- Full-text log search with filters (service, level, time range)
- Service enumeration
- Log statistics

**Key models:** LogEntry

---

### 10. Alerting Service (:8511)

Alert policy management.

**Responsibilities:**
- Alert policy CRUD (threshold, anomaly, composite)
- Alert evaluation
- Notification channel configuration (email, Slack, webhook)

**Key models:** AlertPolicy, AlertEvent, NotificationChannel

---

### 11. Synthetic Service (:8512)

Synthetic monitoring.

**Responsibilities:**
- HTTP endpoint health check monitors
- Configurable schedules and assertions
- Uptime tracking and results history

**Key models:** SyntheticMonitor, SyntheticResult

---

### 12. Security Service (:8513)

Vulnerability management.

**Responsibilities:**
- Vulnerability ingestion from security scanners
- Severity tracking and filtering

**Key models:** Vulnerability

---

### 13. Cloud Connector Service (:8514)

Cloud infrastructure sync.

**Responsibilities:**
- Manage cloud connections (AWS, Azure, GCP) with encrypted credentials
- Background sync workers to pull infrastructure data
- Connection health testing

**Key models:** CloudConnection

---

### 14. CI/CD Connector Service (:8515)

CI/CD pipeline integration.

**Responsibilities:**
- Manage CI/CD connections (GitHub Actions, Azure DevOps, GitLab, Jenkins, Bitbucket)
- List pipelines, repos, and workflow runs
- Receive webhook events for build status
- Encrypted credential storage

**Key models:** CICDConnection

---

## Data Layer

### PostgreSQL (External)

Primary persistent storage for all application data. Configured via `POSTGRES_HOST`, `POSTGRES_PORT`, etc. in `.env`. All services share the same database via Django ORM models in `shared/models/`.

**Key design choices:**
- UUIDs for all primary keys
- Multi-tenant isolation via `tenant_id` / `project_id` on every row
- JSONB columns for flexible metadata
- `created_at` / `updated_at` timestamps on all models

### Redis (Containerized)

Caching, real-time messaging, and distributed coordination.

**Use cases:**
- WebSocket Pub/Sub channels
- AI request deduplication (distributed locks)
- Rate limiting counters
- Session / response caching

---

## Security Architecture

### Authentication Flow

```
1. User registers / logs in via Auth Service
2. Auth Service returns JWT access token (15 min) + refresh token (7 days)
3. Tokens stored in httpOnly cookies (XSS protection)
4. Every request -> API Gateway verifies JWT
5. API Gateway extracts project_id from JWT claims
6. project_id forwarded as query param to backend services
7. Token expiry -> automatic refresh via /auth/refresh
```

### Multi-Tenancy Isolation

Every database query filters by `project_id` (extracted from JWT, never from client input). Services treat `project_id` as a required parameter. The centralized validation in `shared/utils/responses.py` enforces this with `validate_project_id()`.

### Data Ingest Authentication

External agents authenticate via API keys (X-API-Key header). The API Gateway validates the key, extracts the associated `project_id` and `tenant_id`, and injects them into the request before forwarding to backend services.

---

## Data Flow

### Incident Creation Flow

```
1. User or Alert -> Creates Incident via API Gateway
2. API Gateway -> Forwards to Incident Service
3. Incident Service -> Saves to PostgreSQL
4. Incident Service -> Publishes event to Redis
5. Incident Service -> Triggers AI Service
6. AI Service -> Checks cache (skip if cached)
7. AI Service -> Generates hypotheses (Azure OpenAI)
8. AI Service -> Saves hypotheses + cost tracking
9. AI Service -> Publishes event to Redis
10. WebSocket Service -> Receives from Redis Pub/Sub
11. WebSocket Service -> Broadcasts to connected clients
12. Frontend -> Updates UI in real-time
```

### Observability Data Ingest Flow

```
1. Agent / SDK -> POST /api/v1/ingest/{type} with API key
2. API Gateway -> Validates API key, extracts project_id/tenant_id
3. API Gateway -> Injects IDs into request body
4. API Gateway -> Forwards to Metrics Collector / Log Service
5. Backend Service -> Saves to PostgreSQL
6. Backend Service -> Returns 200 OK
```

---

## Port Allocation

| Service | Port | Protocol | Exposed to Host |
|---------|------|----------|-----------------|
| Frontend | 3000 | HTTP | Yes (3000) |
| API Gateway | 8500 | HTTP | Yes (8580) |
| Auth Service | 8501 | HTTP | No |
| Incident Service | 8502 | HTTP | No |
| AI Service | 8503 | HTTP | No |
| Integration Service | 8504 | HTTP | No |
| WebSocket Service | 8505 | WS | Yes (8505) |
| Audit Service | 8508 | HTTP | No |
| Metrics Collector | 8509 | HTTP | No |
| Log Service | 8510 | HTTP | No |
| Alerting Service | 8511 | HTTP | No |
| Synthetic Service | 8512 | HTTP | No |
| Security Service | 8513 | HTTP | No |
| Cloud Connector | 8514 | HTTP | No |
| CI/CD Connector | 8515 | HTTP | No |
| Redis | 6379 | TCP | No |

---

## Docker Networks

- **frontend-network** -- API Gateway, WebSocket Service, Frontend
- **backend-network** -- All backend services, Redis

Backend services are not exposed to the host. All client traffic goes through the API Gateway (port 8580) or WebSocket Service (port 8505).
