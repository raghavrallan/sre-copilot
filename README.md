<p align="center">
  <h1 align="center">SRE Copilot</h1>
  <p align="center">
    <strong>Multi-Tenant SaaS Observability & Incident Intelligence Platform</strong>
  </p>
  <p align="center">
    <a href="#key-features">Features</a> &middot;
    <a href="#architecture">Architecture</a> &middot;
    <a href="#quick-start">Quick Start</a> &middot;
    <a href="#kubernetes-deployment">Kubernetes</a> &middot;
    <a href="#documentation">Docs</a>
  </p>
</p>

---

SRE Copilot is a full-stack observability platform that collects metrics, logs, traces, errors, and infrastructure data from your systems via lightweight agents. It provides **AI-powered incident management**, hypothesis generation, alerting, synthetic monitoring, security vulnerability tracking, and CI/CD pipeline visibility — all in a single, multi-tenant platform.

Built with **14 Python/FastAPI microservices**, a **React/TypeScript frontend**, and designed for both **Docker Compose** (local dev) and **Kubernetes** (production-grade) deployment.

---

## Key Features

| Category | Capabilities |
|----------|-------------|
| **Observability** | Metrics collection, log aggregation, distributed tracing, error tracking |
| **Incident Intelligence** | AI-powered hypothesis generation & root cause analysis (Azure OpenAI GPT-4o-mini) |
| **Alerting & SLOs** | Configurable alert policies, SLO/SLI tracking, burn-rate alerts |
| **Synthetic Monitoring** | Scheduled HTTP endpoint health checks, uptime tracking |
| **Security** | Vulnerability ingestion, CVE tracking, security scanning |
| **CI/CD Integration** | GitHub Actions & Azure DevOps pipeline visibility |
| **Cloud Connectors** | AWS, Azure, and GCP infrastructure monitoring |
| **Real-Time** | WebSocket-powered live dashboards with auto-reconnect |
| **Multi-Tenancy** | Full tenant & project isolation with RBAC (Owner, Admin, Engineer, Viewer) |

---

## Architecture

```
                              ┌─────────────────────────────────┐
                              │     External Systems / Agents    │
                              │  (Prometheus, Infra Agent, SDK)  │
                              └───────────────┬─────────────────┘
                                              │ API Key Auth
                                              ▼
┌──────────────────┐               ┌──────────────────────────┐
│     Frontend     │◀─────WS──────│    WebSocket Service      │
│   (React SPA)    │               │         :8505             │
│     :3000        │               └────────────┬─────────────┘
└────────┬─────────┘                            │ Redis Pub/Sub
         │ HTTP                                 │
         ▼                                      │
┌───────────────────────────────────────────────────────────────────┐
│                        API Gateway :8500                          │
│     JWT Auth  │  Rate Limiting  │  CORS  │  Request Routing       │
└───┬────────┬────────┬────────┬────────┬────────┬─────────────────┘
    │        │        │        │        │        │
    ▼        ▼        ▼        ▼        ▼        ▼
┌────────┐┌────────┐┌────────┐┌────────┐┌────────┐┌────────────────┐
│  Auth  ││Incident││   AI   ││Integr. ││ Audit  ││   Metrics      │
│ :8501  ││ :8502  ││ :8503  ││ :8504  ││ :8508  ││ Collector :8509│
└────────┘└────────┘└────────┘└────────┘└────────┘└────────────────┘
┌────────┐┌────────┐┌────────┐┌────────┐┌────────────────┐
│  Log   ││Alerting││Synthtic││Security││Cloud Connector │
│ :8510  ││ :8511  ││ :8512  ││ :8513  ││     :8514      │
└────────┘└────────┘└────────┘└────────┘└────────────────┘
┌────────────────┐
│CI/CD Connector │
│     :8515      │
└────────────────┘
    │        │        │        │        │        │
    └────────┴────────┴────┬───┴────────┴────────┘
                           │
            ┌──────────────┴──────────────┐
            │    PostgreSQL (external)     │
            │    Redis 7 (container)       │
            └─────────────────────────────┘
```

---

## Technology Stack

<table>
<tr><td>

### Backend
- **API Framework** — FastAPI (Python 3.11+)
- **ORM** — Django ORM 5.0 (standalone, async via `sync_to_async`)
- **Database** — PostgreSQL 13+
- **Cache / Pub-Sub** — Redis 7+
- **AI** — Azure OpenAI GPT-4o-mini

</td><td>

### Frontend
- **Framework** — React 18 + TypeScript
- **Build Tool** — Vite
- **UI** — shadcn/ui + Tailwind CSS
- **State** — Zustand
- **Charts** — Recharts
- **Real-Time** — WebSocket with auto-reconnect

</td></tr>
<tr><td>

### Infrastructure
- **Containers** — Docker + Docker Compose
- **Orchestration** — Kubernetes (Kustomize)
- **CI/CD** — GitHub Actions
- **Monitoring** — Prometheus metrics (`/metrics`)

</td><td>

### Shared Module
- **Django ORM models** — used by all backends
- **Database migrations** — centralized
- **Utilities** — response helpers, validation

</td></tr>
</table>

---

## Microservices

| Service | Port | Description |
|---------|------|-------------|
| **api-gateway** | 8500 | Central entry point — auth verification, rate limiting, request routing |
| **auth-service** | 8501 | JWT authentication, RBAC, tenant & project management |
| **incident-service** | 8502 | Incident lifecycle, state machine, hypothesis coordination |
| **ai-service** | 8503 | AI hypothesis generation, cost analytics (Azure OpenAI) |
| **integration-service** | 8504 | Prometheus / AlertManager webhook receivers |
| **websocket-service** | 8505 | Real-time bidirectional updates (WebSocket + Redis Pub/Sub) |
| **audit-service** | 8508 | API audit logging, compliance trails |
| **metrics-collector-service** | 8509 | Metrics, traces, errors, infrastructure, dashboards, SLOs, deployments |
| **log-service** | 8510 | Log ingestion, search, statistics |
| **alerting-service** | 8511 | Alert policies, evaluation, notification channels |
| **synthetic-service** | 8512 | Synthetic HTTP monitors, uptime checks |
| **security-service** | 8513 | Vulnerability ingestion and tracking |
| **cloud-connector-service** | 8514 | AWS / Azure / GCP infrastructure sync |
| **cicd-connector-service** | 8515 | GitHub Actions / Azure DevOps pipeline integration |
| **frontend** | 80/3000 | React SPA (nginx in K8s, Vite dev server in Compose) |

---

## Quick Start

### Prerequisites

- **Docker Desktop** (or Docker Engine 20.10+ with Compose v2)
- **Git**
- **PostgreSQL 13+** (external — not included in Docker Compose)
- **8 GB RAM** minimum

### 1. Clone and Configure

```bash
git clone https://github.com/raghavrallan/sre-copilot.git
cd sre-copilot
cp .env.example .env
```

Edit `.env` with your PostgreSQL host, credentials, and Azure OpenAI keys.

### 2. Start All Services

```bash
docker compose up -d
```

### 3. Access the Application

| URL | Description |
|-----|-------------|
| `http://localhost:3000` | Frontend UI |
| `http://localhost:8580` | API Gateway |
| `http://localhost:8580/docs` | Swagger API Docs |
| `ws://localhost:8505/ws` | WebSocket (real-time updates) |

### 4. Register and Explore

1. Open `http://localhost:3000/register`
2. Create an account (organization, name, email, password)
3. You'll be redirected to the dashboard with real-time monitoring

---

## Kubernetes Deployment

SRE Copilot can be deployed to Kubernetes using **Kustomize** with a base + overlay pattern. The `infra/kubernetes/` directory contains everything needed.

### K8s Architecture

```
                    ┌──────────────────────────────────────┐
                    │           localhost:30000             │
                    │          (NodePort Service)           │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────▼───────────────────┐
                    │          Frontend (nginx)             │
                    │   - Static SPA files                  │
                    │   - /api/* → api-gateway:8500         │
                    │   - /ws   → websocket-service:8505   │
                    └────────┬─────────────────┬───────────┘
                             │                 │
                ┌────────────▼──┐    ┌─────────▼───────────┐
                │  API Gateway  │    │  WebSocket Service   │
                │    :8500      │    │      :8505           │
                └───────┬───────┘    └─────────────────────┘
                        │
    ┌───────────────────┼───────────────────────────┐
    │                   │                           │
    ▼                   ▼                           ▼
┌─────────┐ ┌───────────┐ ┌─────────┐ ┌──────────────────┐
│  Auth   │ │ Incident  │ │   AI    │ │  Integration     │
│  :8501  │ │  :8502    │ │  :8503  │ │     :8504        │
└─────────┘ └───────────┘ └─────────┘ └──────────────────┘
┌─────────┐ ┌───────────┐ ┌─────────┐ ┌──────────────────┐
│  Audit  │ │  Metrics  │ │   Log   │ │  Alerting        │
│  :8508  │ │  :8509    │ │  :8510  │ │     :8511        │
└─────────┘ └───────────┘ └─────────┘ └──────────────────┘
┌─────────┐ ┌───────────┐ ┌──────────────────┐ ┌─────────┐
│Synthetic│ │ Security  │ │Cloud Connector   │ │  CI/CD  │
│  :8512  │ │  :8513    │ │    :8514         │ │  :8515  │
└─────────┘ └───────────┘ └──────────────────┘ └─────────┘
    │            │              │          │
    └────────────┴──────┬───────┴──────────┘
                        │          All services: ClusterIP
    ┌───────────────────┴──────────────────┐
    │                                      │
┌───▼────────────────────┐  ┌──────────────▼──────────────┐
│  Redis (StatefulSet)   │  │  External PostgreSQL        │
│       :6379            │  │  (Headless Svc + Endpoints) │
└────────────────────────┘  └─────────────────────────────┘
```

**Design highlights:**
- **Single entry point** — nginx reverse proxy on NodePort 30000 (no CORS issues)
- **Kustomize overlays** — base manifests + local overlay for secrets
- **Parameterized Dockerfiles** — one `Dockerfile.service` builds all 14 backends
- **`imagePullPolicy: Never`** — images built locally, shared via Docker Desktop daemon

### K8s Directory Structure

```
infra/kubernetes/
├── docker/
│   ├── Dockerfile.service          # Parameterized backend (ARG SERVICE_NAME/PORT)
│   └── Dockerfile.frontend         # Multi-stage: node build → nginx serve
├── scripts/
│   ├── build-images.sh             # Builds all 15 images
│   ├── deploy.sh                   # kubectl apply + rollout wait
│   └── teardown.sh                 # Full cleanup
├── base/
│   ├── kustomization.yaml          # Aggregates all resources
│   ├── namespace.yaml              # namespace: sre-copilot
│   ├── configmap-db.yaml           # Database connection config
│   ├── configmap-services.yaml     # Inter-service URLs + Redis
│   ├── secret-common.yaml          # Placeholder secrets
│   ├── postgres-external.yaml      # Headless Service + Endpoints
│   ├── redis/                      # StatefulSet + Service + PVC
│   └── services/                   # 14 backends + frontend
│       ├── api-gateway/            # deployment.yaml + service.yaml
│       ├── auth-service/
│       ├── ...                     # (one directory per service)
│       └── frontend/               # + nginx-configmap.yaml
└── overlays/
    └── local/
        ├── kustomization.yaml
        └── secret-local.yaml       # Real credentials (gitignored)
```

### Deploy to Kubernetes

```bash
# Prerequisites: Docker Desktop with Kubernetes enabled, 8GB+ RAM

# 1. Build all 15 Docker images
bash infra/kubernetes/scripts/build-images.sh

# 2. Create secret overlay with real credentials
cp infra/kubernetes/overlays/local/secret-local.yaml.example \
   infra/kubernetes/overlays/local/secret-local.yaml
# Edit secret-local.yaml with your actual credentials

# 3. Deploy everything
bash infra/kubernetes/scripts/deploy.sh
# Or manually: kubectl apply -k infra/kubernetes/overlays/local/

# 4. Watch pods come up
kubectl -n sre-copilot get pods -w

# 5. Access the platform
open http://localhost:30000
```

| K8s URL | Description |
|---------|-------------|
| `http://localhost:30000` | Frontend UI + API (via nginx proxy) |
| `http://localhost:30000/api/health` | API Gateway health check |
| `ws://localhost:30000/ws` | WebSocket (real-time updates) |

### Teardown

```bash
bash infra/kubernetes/scripts/teardown.sh
```

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

# Frontend (Docker Compose)
VITE_API_GATEWAY_URL=http://localhost:8580
VITE_WEBSOCKET_URL=ws://localhost:8505
```

---

## Data Ingestion

External systems send observability data via the **Ingest API**, authenticated with API keys:

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

**Supported endpoints:** `/metrics`, `/traces`, `/errors`, `/logs`, `/infrastructure`, `/browser`, `/vulnerabilities`

---

## Project Structure

```
sre-copilot/
├── services/                          # 14 backend microservices
│   ├── api-gateway/                   # Central routing & auth verification
│   ├── auth-service/                  # JWT auth, RBAC, tenant management
│   ├── incident-service/              # Incident lifecycle & AI coordination
│   ├── ai-service/                    # Azure OpenAI hypothesis generation
│   ├── integration-service/           # Prometheus/AlertManager webhooks
│   ├── websocket-service/             # Real-time updates (WebSocket + Redis)
│   ├── audit-service/                 # Audit logging & compliance
│   ├── metrics-collector-service/     # Metrics, traces, errors, SLOs
│   ├── log-service/                   # Log ingestion & search
│   ├── alerting-service/              # Alert policies & notifications
│   ├── synthetic-service/             # Synthetic monitoring
│   ├── security-service/              # Vulnerability tracking
│   ├── cloud-connector-service/       # AWS/Azure/GCP integration
│   └── cicd-connector-service/        # CI/CD pipeline integration
│
├── frontend/                          # React 18 + TypeScript SPA
│   └── src/
│       ├── components/                # UI components (shadcn/ui)
│       ├── pages/                     # Route pages
│       ├── contexts/                  # WebSocket, theme providers
│       ├── hooks/                     # Custom React hooks
│       ├── lib/stores/                # Zustand state stores
│       └── services/                  # API client layer
│
├── shared/                            # Shared code across all backends
│   ├── models/                        # Django ORM models
│   ├── migrations/                    # Database migrations
│   ├── config/                        # Django settings
│   └── utils/                         # Validation, response helpers
│
├── infra/kubernetes/                  # Kubernetes manifests (Kustomize)
│   ├── docker/                        # K8s-specific Dockerfiles
│   ├── scripts/                       # Build, deploy, teardown scripts
│   ├── base/                          # Base manifests
│   └── overlays/local/                # Local dev overlay
│
├── agent/infra-agent/                 # Lightweight data collection agent
├── sdk/python/                        # Python SDK for data ingestion
├── monitoring/                        # Prometheus / Grafana configs
├── docs/                              # Documentation
│   ├── architecture/                  # System architecture, data flow
│   ├── api-specs/                     # API reference, webhooks
│   ├── guides/                        # Getting started, testing
│   ├── features/                      # Feature specifications
│   ├── data-models/                   # Database schema
│   ├── case-studies/                  # Deployment case studies
│   └── tech-stack/                    # Technology choices
├── diagrams/                          # Architecture diagrams
├── docker-compose.yml                 # Local dev orchestration
└── .env                               # Environment configuration
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](docs/guides/getting-started.md) | Docker Compose setup guide |
| [System Architecture](docs/architecture/system-architecture.md) | Full architecture overview |
| [Data Flow](docs/architecture/data-flow.md) | How data moves through the system |
| [API Reference](docs/api-specs/README.md) | REST API specifications |
| [Webhook API](docs/api-specs/webhooks.md) | AlertManager / Prometheus webhooks |
| [Data Models](docs/data-models/core-models.md) | Database schema |
| [K8s Deployment Case Study](docs/case-studies/k8s-local-deployment.md) | Kubernetes deployment walkthrough |
| [Testing Guide](docs/guides/testing.md) | Testing strategy |
| [Security Policy](docs/security.md) | Security measures and reporting |
| [Technology Choices](docs/tech-stack/technology-choices.md) | Tech stack rationale |
| [Folder Structure](docs/folder-structure.md) | Detailed project layout |

---

## Contributing

### Branching Strategy

We use **GitHub Flow**:
- `main` is production-ready
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

**Proprietary** — All rights reserved. Copyright 2026 SRE Copilot.

<!-- activity: pr-2-sre-copilot -->
