# SRE Copilot - System Architecture

**Last Updated:** 2026-02-01
**Version:** 2.0

---

## Overview

SRE Copilot is a microservices-based AI-powered SRE platform designed for incident management, hypothesis generation, and operational intelligence. The system follows a modular architecture with clear separation of concerns.

---

## Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │       Load Balancer / Ingress       │
                    └─────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
            ┌──────────────┐                 ┌──────────────┐
            │   Frontend   │◀───WebSocket────│  WebSocket   │
            │   (React)    │                 │   Service    │
            │   :5173      │                 │   :8005      │
            └──────────────┘                 └──────────────┘
                    │                                 │
                    ▼                                 │
            ┌──────────────┐                         │
            │ API Gateway  │◀────────────────────────┘
            │ 🔒 Encrypted │
            │ 🚦 Rate Ltd  │
            │   :8000      │
            └──────────────┘
                    │
    ┌───────────────┼───────────────┬──────────────┬──────────────┐
    ▼               ▼               ▼              ▼              ▼
┌────────┐   ┌────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  Auth  │   │  Incident  │  │    AI    │  │Integration│ │  Audit   │
│Service │   │  Service   │  │ Service  │  │  Service  │ │  Service │
│ :8001  │   │   :8002    │  │  :8003   │  │   :8004   │ │   :8008  │
└────────┘   └────────────┘  └──────────┘  └──────────┘  └──────────┘
                    │               │              │              │
    ┌───────────────┼───────────────┼──────────────┴──────────────┘
    ▼               ▼               ▼
┌────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL │  │    Redis     │  │  Prometheus  │
│ (Primary)  │  │  (Cache +    │  │  + Grafana   │
│   :5432    │  │   Pub/Sub)   │  │ (Monitoring) │
│            │  │    :6379     │  │ :9090/:3000  │
└────────────┘  └──────────────┘  └──────────────┘
```

---

## Core Microservices

### 1. API Gateway (:8000)

**Purpose:** Central entry point for all API requests with routing, authentication verification, and cross-cutting concerns.

**Key Responsibilities:**
- Request routing to appropriate microservices
- JWT token verification (delegates to Auth Service)
- Rate limiting (token bucket algorithm)
- End-to-end encryption (AES-256-GCM)
- CORS handling
- Health check aggregation

**Technology:** FastAPI (Python)

**Key Files:**
- `services/api-gateway/app/main.py` - Application entry
- `services/api-gateway/app/api/proxy.py` - Request proxying
- `services/api-gateway/app/middleware/encryption_middleware.py` - E2E encryption

---

### 2. Auth Service (:8001)

**Purpose:** User authentication, authorization, tenant management, and project-based access control.

**Key Responsibilities:**
- User registration and login
- JWT token generation and validation
- Refresh token mechanism (httpOnly cookies)
- Multi-tenant management (Tenant model)
- Project-based RBAC (owner, admin, engineer, viewer)
- Monitoring integration management

**Technology:** FastAPI + Django ORM

**Key Models:**
- `Tenant` - Organization/company
- `User` - User accounts
- `Project` - Project within tenant
- `ProjectMember` - User-project associations
- `MonitoringIntegration` - Prometheus/Grafana configs

**Key Files:**
- `services/auth-service/app/api/auth.py` - Authentication endpoints
- `services/auth-service/app/api/projects.py` - Project management
- `services/auth-service/app/api/monitoring.py` - Monitoring integrations
- `services/auth-service/app/core/security.py` - JWT & security

---

### 3. Incident Service (:8002)

**Purpose:** Incident lifecycle management, state machine, and hypothesis coordination.

**Key Responsibilities:**
- Incident CRUD operations
- Incident state transitions (DETECTED → RESOLVED)
- Triggers AI hypothesis generation
- Hypothesis retrieval and management
- Workflow tracking (analysis steps)
- Real-time updates via Redis Pub/Sub

**Technology:** FastAPI + Django ORM

**State Machine:**
```
DETECTED → ACKNOWLEDGED → INVESTIGATING → MITIGATED → RESOLVED → LEARNED
                                        └→ INCONCLUSIVE
```

**Key Models:**
- `Incident` - Production incidents
- `Hypothesis` - AI-generated root causes
- `AnalysisStep` - Workflow pipeline tracking

**Key Files:**
- `services/incident-service/app/api/incidents.py` - Incident endpoints
- `services/incident-service/app/api/workflow.py` - Workflow tracking
- `services/incident-service/app/services/redis_publisher.py` - Real-time updates

---

### 4. AI Service (:8003)

**Purpose:** AI-powered hypothesis generation and analytics using Azure OpenAI GPT-4o-mini.

**Key Responsibilities:**
- Hypothesis generation (3-5 root causes per incident)
- Confidence scoring
- Evidence aggregation
- Token usage tracking
- Cost analytics
- Caching layer (database + Redis)

**Technology:** FastAPI + Azure OpenAI API

**Cost Optimization Features:**
- Database caching (prevents duplicate AI calls)
- Redis locking (prevents concurrent duplicates)
- Optimized prompts (60% token reduction)
- Comprehensive tracking (AIRequest model)

**Key Models:**
- `AIRequest` - Tracks every AI call with tokens/cost
- `AnalysisStep` - Pipeline step tracking

**Key Files:**
- `services/ai-service/app/api/ai.py` - Hypothesis generation
- `services/ai-service/app/api/analytics.py` - Cost analytics

---

### 5. Integration Service (:8004)

**Purpose:** External tool integrations (Prometheus, AlertManager, Grafana).

**Key Responsibilities:**
- Webhook receivers for AlertManager/Prometheus
- Alert-to-incident conversion
- Metric collection coordination
- Integration health monitoring

**Technology:** FastAPI

**Supported Integrations:**
- Prometheus (metrics)
- AlertManager (alerts)
- Grafana (dashboards)

**Key Files:**
- `services/integration-service/app/api/webhooks.py` - Webhook handlers
- `services/integration-service/app/services/incident_client.py` - Incident creation

---

### 6. WebSocket Service (:8005)

**Purpose:** Real-time bidirectional communication for live updates.

**Key Responsibilities:**
- WebSocket connections with JWT auth
- Redis Pub/Sub integration
- Tenant isolation
- Channel subscriptions
- Heartbeat/keep-alive
- Auto-reconnection support

**Technology:** FastAPI + WebSocket + Redis Pub/Sub

**Event Types:**
- `incident.created` - New incidents
- `incident.updated` - State changes
- `hypothesis.generated` - AI hypotheses ready
- `alert.fired` - Prometheus alerts

**Key Files:**
- `services/websocket-service/app/main.py` - WebSocket server
- `services/websocket-service/app/websocket/connection_manager.py` - Connection handling
- `services/websocket-service/app/websocket/redis_pubsub.py` - Pub/Sub integration

---

### 7. Audit Service (:8008)

**Purpose:** Comprehensive audit logging for compliance and debugging.

**Key Responsibilities:**
- All API calls logged
- User action tracking
- Resource change history (before/after)
- Audit statistics
- Retention policies

**Technology:** FastAPI + In-memory storage (upgradeable to PostgreSQL)

**Key Files:**
- `services/audit-service/app/main.py` - Audit endpoints

---

## Data Layer

### PostgreSQL (Primary Database)

**Purpose:** Persistent storage for all application data.

**Key Tables:**
- `tenants` - Organizations
- `users` - User accounts
- `projects` - Projects within tenants
- `project_members` - User-project associations
- `incidents` - Production incidents
- `hypotheses` - AI-generated hypotheses
- `ai_requests` - AI call tracking
- `analysis_steps` - Workflow pipeline
- `monitoring_integrations` - Integration configs

**Features:**
- Multi-tenant isolation
- Full-text search
- JSONB for flexible schemas
- Comprehensive indexing

---

### Redis (Cache & Pub/Sub)

**Purpose:** Caching, real-time messaging, and distributed locking.

**Use Cases:**
- Session caching
- API response caching
- AI request deduplication (locks)
- WebSocket Pub/Sub channels
- Rate limiting counters

---

## Security Architecture

### Authentication Flow

```
1. User Login → Auth Service
2. JWT Access Token (15 min) + Refresh Token (7 days) returned
3. Tokens stored in httpOnly cookies (XSS protection)
4. Each request → API Gateway verifies token
5. Token expiry → Automatic refresh via /auth/refresh
```

### Security Features

| Feature | Implementation |
|---------|----------------|
| Authentication | JWT tokens (HS256) |
| Token Storage | httpOnly cookies |
| Password Hashing | bcrypt |
| API Encryption | AES-256-GCM (optional) |
| Rate Limiting | Token bucket (100 req/min) |
| CORS | Configured origins only |
| Secrets | Environment variables |

---

## Data Flow

### Incident Creation Flow

```
1. User/Alert → Creates Incident
2. Incident Service → Saves to PostgreSQL
3. Incident Service → Publishes to Redis
4. Incident Service → Triggers AI Service
5. AI Service → Checks cache (skip if cached)
6. AI Service → Generates hypotheses (Azure OpenAI)
7. AI Service → Saves hypotheses + tracking
8. AI Service → Publishes to Redis
9. WebSocket Service → Broadcasts to clients
10. Frontend → Updates UI in real-time
```

### Alert-to-Incident Flow

```
1. Prometheus → Detects anomaly
2. AlertManager → Routes to webhook
3. Integration Service → Receives webhook
4. Integration Service → Creates incident
5. [Follows Incident Creation Flow]
```

---

## Scalability Considerations

### Horizontal Scaling
- All services are stateless (except PostgreSQL)
- Redis for distributed state
- Load balancer for service distribution

### Multi-Tenancy
- Tenant isolation at database level
- Project-scoped data access
- Per-tenant rate limits

### Caching Strategy
- AI responses cached 24 hours
- API responses cached (configurable)
- Redis for distributed caching

---

## Deployment Architecture

### Development (Docker Compose)

```yaml
services:
  - frontend (Vite dev server)
  - api-gateway
  - auth-service
  - incident-service
  - ai-service
  - integration-service
  - websocket-service
  - audit-service
  - postgres
  - redis
```

### Production (Kubernetes)

```
- AKS (Azure Kubernetes Service)
- Azure Database for PostgreSQL
- Azure Cache for Redis
- Azure Container Registry
- Ingress Controller (nginx)
- Horizontal Pod Autoscaling
```

---

## Monitoring & Observability

### Prometheus Stack
- **Prometheus** (:9090) - Metrics collection
- **AlertManager** (:9093) - Alert routing
- **Grafana** (:3000) - Dashboards

### Alert Categories
- Composite Alerts (multi-metric)
- Anomaly Detection (statistical)
- SLO/SLI Tracking
- Correlation Alerts
- Predictive Alerts

### Metrics Tracked
- API latency (p50, p95, p99)
- Error rates
- AI token usage and costs
- Cache hit rates
- WebSocket connections

---

## Key Design Principles

### 1. LLM as Assistant, Not Decision Maker
- AI generates candidates
- Deterministic code scores them
- Policies define actions
- Always explainable

### 2. Multi-Tenant from Day 1
- Complete data isolation
- Per-tenant configurations
- Scalable to many customers

### 3. Event-Driven Updates
- Redis Pub/Sub for real-time
- WebSocket for frontend
- Async processing where possible

### 4. Cost Optimization
- AI response caching
- Token usage tracking
- Budget monitoring

---

## Port Allocation

| Service | Port | Protocol |
|---------|------|----------|
| Frontend | 5173 | HTTP |
| API Gateway | 8000 | HTTP |
| Auth Service | 8001 | HTTP |
| Incident Service | 8002 | HTTP |
| AI Service | 8003 | HTTP |
| Integration Service | 8004 | HTTP |
| WebSocket Service | 8005 | WS |
| Audit Service | 8008 | HTTP |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| Prometheus | 9090 | HTTP |
| Grafana | 3000 | HTTP |
| AlertManager | 9093 | HTTP |

---

## Related Documentation

- [Technology Choices](../tech-stack/technology-choices.md)
- [Data Models](../data-models/core-models.md)
- [API Specifications](../api-specs/README.md)
- [Phase 1 Features](../features/phase-1-v1-features.md)
