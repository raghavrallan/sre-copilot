# SRE Copilot -- Folder Structure

## Root Structure

```
sre-copilot/
├── .github/workflows/               # GitHub Actions CI/CD
├── .rules/                          # Project rules for AI assistants
│   ├── PROJECT_RULES.md
│   ├── CODING_STANDARDS.md
│   └── AI_ASSISTANT_RULES.md
│
├── services/                        # Backend microservices (14 services)
│   ├── api-gateway/                 # Port 8500 (external 8580)
│   ├── auth-service/                # Port 8501
│   ├── incident-service/            # Port 8502
│   ├── ai-service/                  # Port 8503
│   ├── integration-service/         # Port 8504
│   ├── websocket-service/           # Port 8505 (external 8505)
│   ├── audit-service/               # Port 8508
│   ├── metrics-collector-service/   # Port 8509
│   ├── log-service/                 # Port 8510
│   ├── alerting-service/            # Port 8511
│   ├── synthetic-service/           # Port 8512
│   ├── security-service/            # Port 8513
│   ├── cloud-connector-service/     # Port 8514
│   └── cicd-connector-service/      # Port 8515
│
├── shared/                          # Shared code across all services
│   ├── config/
│   │   └── settings.py              # Django settings (DB, timezone, etc.)
│   ├── models/
│   │   ├── __init__.py              # Model exports
│   │   ├── tenant.py                # Tenant, User, Project, ProjectMember
│   │   ├── incident.py              # Incident, Hypothesis, AnalysisStep
│   │   ├── observability.py         # Metrics, Logs, Traces, Errors, Infra, Browser
│   │   ├── cloud_connection.py      # CloudConnection model
│   │   └── connection_config.py     # CICDConnection model
│   ├── migrations/                  # Django database migrations
│   ├── utils/
│   │   ├── responses.py             # Centralized validation & response helpers
│   │   └── internal_auth.py         # Service-to-service auth
│   └── apps.py
│
├── frontend/                        # React + TypeScript (Port 3000)
│   ├── src/
│   │   ├── components/              # UI components
│   │   │   ├── ui/                  # shadcn/ui primitives
│   │   │   ├── settings/            # Settings page components
│   │   │   ├── workflow/            # Incident workflow components
│   │   │   └── ...
│   │   ├── pages/                   # Page components (one per route)
│   │   ├── contexts/                # React contexts (WebSocket, theme)
│   │   ├── hooks/                   # Custom React hooks
│   │   ├── lib/stores/              # Zustand state stores
│   │   ├── services/                # API client (api.ts)
│   │   └── types/                   # TypeScript interfaces
│   └── public/
│
├── agent/infra-agent/               # Lightweight infrastructure agent
├── sdk/python/                      # Python SDK for data ingestion
├── monitoring/                      # Prometheus / Grafana configs
├── infra/                           # Terraform / Kubernetes manifests
├── sprints/                         # Sprint planning docs
├── diagrams/                        # Architecture diagrams
│
├── docs/                            # Documentation
│   ├── architecture/
│   │   ├── system-architecture.md
│   │   └── data-flow.md
│   ├── api-specs/
│   │   ├── README.md
│   │   └── webhooks.md
│   ├── guides/
│   │   ├── getting-started.md
│   │   ├── testing.md
│   │   └── security.md
│   ├── features/
│   │   └── phase-1-v1-features.md
│   ├── data-models/
│   │   └── core-models.md
│   ├── tech-stack/
│   │   └── technology-choices.md
│   ├── security.md
│   └── folder-structure.md          # This file
│
├── docker-compose.yml               # Local development orchestration
├── .env                             # Environment variables
└── README.md                        # Project overview
```

---

## Microservice Layout

Each service under `services/` follows the same structure:

```
services/<service-name>/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI entry point
│   ├── api/                     # Route handlers
│   ├── core/                    # Config, auth, security
│   └── ...                      # Service-specific modules
└── shared -> /app/shared        # Mounted via Docker volume
```

---

## Service Descriptions

### API Gateway (port 8500, external 8580)

Central entry point for all client requests. Verifies JWT tokens, extracts `project_id` from user context, and proxies requests to the correct backend service. Also handles rate limiting, CORS, and the public data ingest API (API-key auth).

Key files:
- `app/api/proxy.py` -- Auth, incidents, AI routes
- `app/api/observability_proxy.py` -- Metrics, logs, alerts, synthetic, security, CI/CD routes
- `app/api/ingest_proxy.py` -- Public ingest endpoints (API-key auth)
- `app/core/config.py` -- Service URLs, timeouts

### Auth Service (port 8501)

User registration, login, JWT issuance (access + refresh tokens stored in httpOnly cookies), tenant management, project RBAC, monitoring integration management, and API key generation.

### Incident Service (port 8502)

Incident CRUD, state machine (DETECTED -> ACKNOWLEDGED -> INVESTIGATING -> MITIGATED -> RESOLVED -> LEARNED), hypothesis coordination, workflow tracking, real-time updates via Redis Pub/Sub.

### AI Service (port 8503)

AI-powered hypothesis generation using Azure OpenAI GPT-4o-mini. Includes caching, token/cost tracking, and analytics dashboards.

### Integration Service (port 8504)

Webhook receivers for Prometheus AlertManager. Converts alerts into incidents.

### WebSocket Service (port 8505)

Real-time bidirectional communication. Authenticates via JWT, subscribes to Redis Pub/Sub channels, and broadcasts events (incident.created, alert.fired, etc.) to connected clients.

### Audit Service (port 8508)

Logs all API operations for compliance and debugging. Tracks user actions, resource changes, and provides audit statistics.

### Metrics Collector Service (port 8509)

Handles metrics ingestion and querying, traces, errors, infrastructure data, browser performance, dashboards, SLOs, and deployment tracking. The largest service by endpoint count.

### Log Service (port 8510)

Log ingestion, full-text search, service enumeration, and log statistics.

### Alerting Service (port 8511)

Alert policy management, alert evaluation, notification channel configuration.

### Synthetic Service (port 8512)

HTTP synthetic monitors for endpoint health checks on configurable schedules.

### Security Service (port 8513)

Vulnerability ingestion and tracking from security scanners.

### Cloud Connector Service (port 8514)

Infrastructure sync for AWS, Azure, and GCP. Manages cloud connections with encrypted credentials and background sync workers.

### CI/CD Connector Service (port 8515)

GitHub Actions and Azure DevOps integration. Manages CI/CD connections, lists pipelines/repos, and receives webhook events for build status.

---

## Shared Code (`shared/`)

All services mount the `shared/` directory via Docker volumes. It contains:

- **Django ORM models** -- Single source of truth for the database schema
- **Django settings** -- Common database, timezone, and secret configuration
- **Centralized validation** (`utils/responses.py`) -- `validate_project_id()`, `validate_required_fields()`, `success_response()`, `error_response()`, and a global `RequestValidationError` -> 400 handler
- **Internal auth** (`utils/internal_auth.py`) -- Service-to-service authentication

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

PostgreSQL is external (not in Docker Compose). Configure via `POSTGRES_HOST` / `POSTGRES_PORT` in `.env`.

---

## Docker Networks

- **frontend-network** -- API Gateway, WebSocket Service, Frontend
- **backend-network** -- All services, Redis
