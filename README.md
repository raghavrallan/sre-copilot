# SRE Copilot

**Multi-Tenant SaaS Observability & Incident Intelligence Platform**

---

## Overview

SRE Copilot is a full-stack SaaS observability platform that collects metrics, logs, traces, errors, and infrastructure data from your systems via lightweight agents. It provides AI-powered incident management, hypothesis generation, alerting, synthetic monitoring, security vulnerability tracking, and CI/CD pipeline visibility -- all in a single, multi-tenant platform.

---

## Key Features

- **Metrics Collection** -- Ingest and query application and infrastructure metrics
- **Log Aggregation** -- Centralized log search, filtering, and analysis
- **Distributed Tracing** -- End-to-end request tracing across services
- **Error Tracking** -- Capture, group, and alert on application errors
- **AI-Powered Incidents** -- Automatic hypothesis generation and root cause analysis (Azure OpenAI GPT-4o-mini)
- **Alerting & SLOs** -- Configurable alert policies with SLO/SLI tracking
- **Synthetic Monitoring** -- HTTP endpoint health checks on a schedule
- **Security Scanning** -- Vulnerability ingestion and tracking
- **CI/CD Integration** -- GitHub Actions and Azure DevOps pipeline visibility
- **Cloud Connectors** -- AWS, Azure, and GCP infrastructure monitoring
- **Real-Time Updates** -- WebSocket-powered live dashboards
- **Multi-Tenancy** -- Full tenant and project isolation with RBAC (Owner, Admin, Engineer, Viewer)

---

## Technology Stack

### Backend
- **API Framework:** FastAPI (Python 3.11+)
- **ORM:** Django ORM 5.0 (standalone, async via `sync_to_async`)
- **Database:** PostgreSQL 13+ (external)
- **Cache / Pub-Sub:** Redis 7+
- **AI:** Azure OpenAI GPT-4o-mini
- **Validation:** Centralized response helpers (`shared/utils/responses.py`)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui + Tailwind CSS
- **State Management:** Zustand
- **Charts:** Recharts
- **Real-Time:** WebSocket context with auto-reconnect

### Infrastructure
- **Containerization:** Docker + Docker Compose
- **Networking:** Segmented frontend / backend Docker networks
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus metrics on every service (`/metrics`)

---

## Microservices

| Service | Internal Port | External Port | Description |
|---------|--------------|---------------|-------------|
| **api-gateway** | 8500 | 8580 | Central entry point, auth verification, request routing |
| **auth-service** | 8501 | -- | JWT authentication, RBAC, tenant/project management |
| **incident-service** | 8502 | -- | Incident lifecycle, state machine, hypothesis coordination |
| **ai-service** | 8503 | -- | AI hypothesis generation, cost analytics (Azure OpenAI) |
| **integration-service** | 8504 | -- | Prometheus/AlertManager webhook receivers |
| **websocket-service** | 8505 | 8505 | Real-time bidirectional updates (WebSocket + Redis Pub/Sub) |
| **audit-service** | 8508 | -- | API audit logging, compliance |
| **metrics-collector-service** | 8509 | -- | Metrics, traces, errors, infrastructure, dashboards, SLOs, deployments |
| **log-service** | 8510 | -- | Log ingestion, search, statistics |
| **alerting-service** | 8511 | -- | Alert policies, evaluation, notification channels |
| **synthetic-service** | 8512 | -- | Synthetic HTTP monitors, uptime checks |
| **security-service** | 8513 | -- | Vulnerability ingestion and tracking |
| **cloud-connector-service** | 8514 | -- | AWS / Azure / GCP infrastructure sync |
| **cicd-connector-service** | 8515 | -- | GitHub Actions / Azure DevOps pipeline integration |
| **frontend** | 3000 | 3000 | React SPA |

---

## Project Structure

```
sre-copilot/
├── README.md
├── docker-compose.yml
├── .env                            # Environment configuration
│
├── docs/                           # Documentation
│   ├── architecture/               # System architecture, data flow
│   ├── api-specs/                  # API reference, webhooks
│   ├── guides/                     # Getting started, testing, security
│   ├── features/                   # Feature specifications
│   ├── data-models/                # Database schema
│   ├── tech-stack/                 # Technology choices
│   ├── security.md                 # Security policy
│   └── folder-structure.md         # Detailed folder structure
│
├── .rules/                         # Project rules for AI assistants
│   ├── PROJECT_RULES.md
│   ├── CODING_STANDARDS.md
│   └── AI_ASSISTANT_RULES.md
│
├── services/                       # Backend microservices
│   ├── api-gateway/                # Port 8500 (ext 8580)
│   ├── auth-service/               # Port 8501
│   ├── incident-service/           # Port 8502
│   ├── ai-service/                 # Port 8503
│   ├── integration-service/        # Port 8504
│   ├── websocket-service/          # Port 8505
│   ├── audit-service/              # Port 8508
│   ├── metrics-collector-service/  # Port 8509
│   ├── log-service/                # Port 8510
│   ├── alerting-service/           # Port 8511
│   ├── synthetic-service/          # Port 8512
│   ├── security-service/           # Port 8513
│   ├── cloud-connector-service/    # Port 8514
│   └── cicd-connector-service/     # Port 8515
│
├── frontend/                       # React + TypeScript (Port 3000)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── contexts/               # WebSocket, theme contexts
│       ├── hooks/
│       ├── lib/stores/             # Zustand stores
│       └── services/               # API client
│
├── shared/                         # Shared code across services
│   ├── models/                     # Django ORM models
│   ├── migrations/                 # Database migrations
│   ├── config/                     # Django settings
│   └── utils/                      # Centralized validation, responses
│
├── agent/infra-agent/              # Lightweight data collection agent
├── sdk/python/                     # Python SDK for data ingestion
├── monitoring/                     # Prometheus / Grafana configs
├── sprints/                        # Sprint planning documents
├── diagrams/                       # Architecture diagrams
└── infra/                          # Terraform / Kubernetes manifests
```

---

## Quick Start

### Prerequisites

- **Docker Desktop** (or Docker Engine 20.10+ with Compose v2)
- **Git**
- **PostgreSQL 13+** (external -- not included in Docker Compose)
- **8 GB RAM** minimum

### 1. Clone and Configure

```bash
git clone https://github.com/raghavrallan/sre-copilot.git
cd sre-copilot
cp .env.example .env
# Edit .env with your PostgreSQL host, credentials, and Azure OpenAI keys
```

### 2. Start All Services

```bash
docker compose up -d
```

### 3. Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Frontend UI |
| http://localhost:8580 | API Gateway |
| http://localhost:8580/docs | Swagger API Docs |
| ws://localhost:8505/ws | WebSocket (real-time updates) |

### 4. Register and Explore

1. Open http://localhost:3000/register
2. Create an account (organization, name, email, password)
3. You will be redirected to the dashboard

---

## Environment Variables

Key variables in `.env`:

```bash
# Database (external PostgreSQL)
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=srecopilot
POSTGRES_USER=srecopilot
POSTGRES_PASSWORD=your-password

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256

# Azure OpenAI (for AI hypothesis generation)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Frontend
VITE_API_GATEWAY_URL=http://localhost:8580
VITE_WEBSOCKET_URL=ws://localhost:8505
```

---

## Data Ingestion

External systems send observability data to the platform via the **Ingest API**, authenticated with API keys:

```bash
# Ingest metrics
curl -X POST http://localhost:8580/api/v1/ingest/metrics \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"metrics": [{"name": "cpu_usage", "value": 72.5, "tags": {"host": "web-01"}}]}'

# Ingest logs
curl -X POST http://localhost:8580/api/v1/ingest/logs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"logs": [{"message": "Request processed", "level": "info", "service": "api"}]}'
```

Supported ingest endpoints: `/metrics`, `/traces`, `/errors`, `/logs`, `/infrastructure`, `/browser`, `/vulnerabilities`

---

## Documentation

- **[Getting Started Guide](docs/guides/getting-started.md)** -- Docker Compose setup
- **[System Architecture](docs/architecture/system-architecture.md)** -- Full architecture overview
- **[Data Flow](docs/architecture/data-flow.md)** -- How data moves through the system
- **[API Reference](docs/api-specs/README.md)** -- REST API specifications
- **[Webhook API](docs/api-specs/webhooks.md)** -- AlertManager / Prometheus webhooks
- **[Data Models](docs/data-models/core-models.md)** -- Database schema
- **[Testing Guide](docs/guides/testing.md)** -- Testing strategy
- **[Security Policy](docs/security.md)** -- Security measures and reporting
- **[Folder Structure](docs/folder-structure.md)** -- Detailed project layout
- **[Technology Choices](docs/tech-stack/technology-choices.md)** -- Tech stack rationale

---

## Contributing

### Branching Strategy

We use **GitHub Flow**:
- `main` branch is production-ready
- Create feature branches from `main`
- Open PRs for all changes
- Squash and merge after review

### Commit Conventions

```
feat: Add SLO burn-rate alerting
fix: Resolve 500 on empty project_id
docs: Update architecture diagram
test: Add integration tests for log-service
chore: Pin Django to 5.0.1 across services
```

---

## License

**Proprietary** -- All rights reserved.

Copyright 2026 SRE Copilot.
