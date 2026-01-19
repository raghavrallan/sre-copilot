# Technology Stack
## SRE Copilot Platform

**Last Updated:** 2026-01-19
**Phase:** 1 (MVP)

---

## Overview

This document outlines all technology choices for the SRE Copilot platform, with rationale for each decision.

---

## Backend Stack

### API Framework: FastAPI

**Choice:** FastAPI 0.109+
**Language:** Python 3.11+

**Rationale:**
- High performance (async/await support)
- Automatic OpenAPI documentation
- Type safety with Pydantic
- Excellent async database support
- Large ecosystem
- Easy integration with Django ORM

**Alternatives Considered:**
- Django REST Framework (too heavy, we only need ORM)
- Flask (lacks async support)
- Node.js/Express (team prefers Python)

---

### ORM: Django ORM

**Choice:** Django 5.0+ (ORM only, not full framework)

**Rationale:**
- Best Python ORM with excellent migration system
- Mature, battle-tested
- Rich query API
- Built-in database migrations
- Can be used standalone with FastAPI
- Your specific requirement

**Configuration:**
```python
# settings.py (Django settings for ORM only)
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'app.models',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.getenv('DB_NAME'),
        'USER': os.getenv('DB_USER'),
        'PASSWORD': os.getenv('DB_PASSWORD'),
        'HOST': os.getenv('DB_HOST'),
        'PORT': os.getenv('DB_PORT', 5432),
    }
}
```

**Integration with FastAPI:**
```python
# main.py
import django
import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'app.settings')
django.setup()

from fastapi import FastAPI
app = FastAPI()
```

**Alternatives Considered:**
- SQLAlchemy (Django ORM is superior for complex queries)
- Prisma (not mature in Python)
- Tortoise ORM (less mature than Django)

---

### Database: PostgreSQL

**Choice:** PostgreSQL 15+

**Rationale:**
- Industry standard for multi-tenant apps
- Excellent JSONB support (for flexible schemas)
- Full-text search capabilities
- TimescaleDB extension for time-series data
- Row-level security for tenant isolation
- ACID compliance

**Extensions Used:**
- **TimescaleDB**: Time-series metrics storage
- **pg_trgm**: Fuzzy text search
- **uuid-ossp**: UUID generation

**Hosting:** Azure Database for PostgreSQL (managed service)

**Alternatives Considered:**
- MySQL (weaker JSON support)
- MongoDB (not suitable for relational data)
- CockroachDB (overkill for MVP)

---

### Cache & Queue: Redis

**Choice:** Redis 7+

**Libraries:**
- `redis-py` for Python client
- `Bull` (via Node.js worker) or `Python-RQ` for job queues

**Use Cases:**
- Session caching
- API response caching
- Job queues (signal processing)
- Rate limiting
- Feature flags
- Real-time Slack message deduplication

**Hosting:** Azure Cache for Redis

**Alternatives Considered:**
- RabbitMQ (Redis simpler for MVP)
- Celery + RabbitMQ (Redis + RQ is lighter)

---

## Frontend Stack

### Framework: React

**Choice:** React 18+ with TypeScript

**Rationale:**
- Industry standard
- Huge ecosystem
- Excellent TypeScript support
- Your specific requirement
- Server components for performance (React 18+)

**Build Tool:** Vite (faster than Create React App)

**Alternatives Considered:**
- Next.js (overkill for dashboard-only app)
- Vue.js (team preference for React)
- Svelte (less mature ecosystem)

---

### UI Library: shadcn/ui + Tailwind CSS

**Choice:**
- **shadcn/ui**: Copy-paste component library (not npm package)
- **Tailwind CSS 3+**: Utility-first CSS

**Rationale:**
- shadcn/ui provides beautiful, accessible components
- Not a dependency (you own the code)
- Tailwind for rapid styling
- Excellent TypeScript support
- Customizable design system

**Component Examples:**
- Button, Card, Dialog, Dropdown
- Table, Tabs, Tooltip
- Form components with validation

**Alternatives Considered:**
- Material-UI (too opinionated)
- Ant Design (heavy bundle size)
- Chakra UI (less customizable)

---

### State Management: Zustand

**Choice:** Zustand

**Rationale:**
- Lightweight (< 1KB)
- Simple API (no boilerplate)
- TypeScript-first
- No Context Provider hell
- Perfect for small-to-medium apps

**Example:**
```typescript
import create from 'zustand'

interface IncidentStore {
  incidents: Incident[]
  fetchIncidents: () => Promise<void>
}

export const useIncidentStore = create<IncidentStore>((set) => ({
  incidents: [],
  fetchIncidents: async () => {
    const res = await fetch('/api/v1/incidents')
    const data = await res.json()
    set({ incidents: data })
  }
}))
```

**Alternatives Considered:**
- Redux Toolkit (too heavy for MVP)
- React Context (insufficient for complex state)
- Jotai (similar, but Zustand more popular)

---

### Charts: Recharts + D3.js

**Choice:**
- **Recharts**: For simple charts
- **D3.js**: For complex visualizations

**Rationale:**
- Recharts is React-friendly, declarative
- D3.js for custom, complex charts (incident timelines)
- Both have TypeScript support

**Alternatives Considered:**
- Chart.js (not React-friendly)
- Victory (heavier than Recharts)
- Plotly (overkill)

---

## AI/ML Stack

### Primary LLM: Claude API (Anthropic)

**Choice:** Claude Sonnet 4.5

**Rationale:**
- Best reasoning capabilities for SRE tasks
- Excellent prompt caching (70% cost reduction)
- 200K context window (fits large context snapshots)
- Function calling support
- Reliable and fast

**Cost Optimization:**
- Prompt caching for context snapshots (5min TTL)
- Prompt caching for runbook corpus (1hr TTL)
- Batch processing for non-urgent tasks

**Fallback:** Haiku (cheaper, faster for simple tasks)

**Alternatives Considered:**
- OpenAI GPT-4 (more expensive, less caching)
- Open-source LLMs (require hosting, less reliable)

---

### Embeddings: OpenAI text-embedding-3-small

**Choice:** OpenAI text-embedding-3-small

**Rationale:**
- Best quality/cost ratio
- 1536 dimensions
- Fast inference
- Excellent for semantic search

**Use Cases:**
- Runbook semantic search
- Incident similarity detection
- Log pattern matching

**Alternatives Considered:**
- Sentence Transformers (hosting overhead)
- OpenAI ada-002 (older model)

---

### ML Models: Prophet + Isolation Forest

**Choice:**
- **Prophet**: Time-series forecasting (by Meta)
- **Isolation Forest**: Anomaly detection

**Rationale:**
- Prophet: Excellent for seasonal patterns, easy to use
- Isolation Forest: Fast, unsupervised anomaly detection
- Both have Python libraries, well-documented

**Libraries:**
- `prophet`
- `scikit-learn` (for Isolation Forest)

**Alternatives Considered:**
- LSTM/ARIMA (too complex for MVP)
- Commercial ML platforms (unnecessary cost)

---

## Data Storage

### Vector Database: Pinecone

**Choice:** Pinecone (managed vector DB)

**Rationale:**
- Fully managed (no ops overhead)
- Excellent performance
- Simple API
- Metadata filtering
- Free tier for MVP

**Use Cases:**
- Runbook semantic search
- Incident similarity search
- Log pattern matching

**Alternatives Considered:**
- Weaviate (requires self-hosting)
- Milvus (complex setup)
- pgvector (PostgreSQL extension, less mature)

---

### Time-Series: TimescaleDB

**Choice:** TimescaleDB (PostgreSQL extension)

**Rationale:**
- PostgreSQL extension (same DB)
- Excellent compression
- SQL interface (familiar)
- Automatic data retention
- Free and open-source

**Use Cases:**
- Metrics storage
- Baseline models
- Forecast storage

**Alternatives Considered:**
- InfluxDB (separate database)
- Prometheus (query-only, not for storage)

---

## Infrastructure & DevOps

### Cloud Platform: Microsoft Azure

**Choice:** Azure (primary)

**Rationale:**
- Your expertise
- Enterprise-friendly
- Excellent for .NET + Python hybrid
- Strong SaaS tooling

**Services Used:**
- **Azure Kubernetes Service (AKS)**: Container orchestration
- **Azure Database for PostgreSQL**: Managed PostgreSQL
- **Azure Cache for Redis**: Managed Redis
- **Azure Blob Storage**: File storage, backups
- **Azure Key Vault**: Secrets management
- **Azure Active Directory**: SSO
- **Azure Monitor**: Observability

**Alternatives Considered:**
- AWS (no specific advantage for this use case)
- GCP (less enterprise adoption)

---

### Container Orchestration: Kubernetes

**Choice:** Kubernetes (via AKS)

**Rationale:**
- Industry standard
- Excellent scaling
- Multi-tenant friendly
- Rich ecosystem (Helm, Istio, etc.)

**Alternatives Considered:**
- Docker Swarm (less mature)
- Azure Container Instances (not scalable enough)
- Serverless (not suitable for stateful services)

---

### Infrastructure as Code: Terraform

**Choice:** Terraform

**Rationale:**
- Multi-cloud support (future-proof)
- Declarative syntax
- Rich Azure provider
- State management
- Reusable modules

**Alternatives Considered:**
- Azure ARM templates (vendor lock-in)
- Pulumi (less mature)
- Ansible (imperative, not ideal for cloud infra)

---

### CI/CD: GitHub Actions

**Choice:** GitHub Actions

**Rationale:**
- Native GitHub integration
- Free for public repos
- Easy YAML syntax
- Good Azure integration
- Marketplace with pre-built actions

**Pipelines:**
- **Lint & Test**: On every PR
- **Build & Push**: On merge to main
- **Deploy to Staging**: On merge to main
- **Deploy to Production**: On tag creation

**Alternatives Considered:**
- Azure DevOps (overkill)
- GitLab CI (would require migration)
- CircleCI (unnecessary cost)

---

## Integrations Stack

### Slack SDK

**Choice:** Slack Bolt SDK (Python)

**Rationale:**
- Official Slack SDK
- Async support
- Easy event handling
- Built-in signature verification

**Alternative:** `slack-sdk` (lower-level, more control)

---

### Prometheus Client

**Choice:** `prometheus-api-client` (Python)

**Rationale:**
- Query PromQL from Python
- Async support
- Simple API

---

### PagerDuty SDK

**Choice:** `pdpyras` (Python)

**Rationale:**
- Official PagerDuty SDK
- REST API wrapper
- Pagination support

---

## Observability

### Monitoring: Prometheus + Grafana

**Choice:**
- **Prometheus**: Metrics collection
- **Grafana**: Visualization

**Rationale:**
- Industry standard
- Open-source
- Rich ecosystem
- Dogfooding our own integrations

**Metrics:**
- Application metrics (API latency, error rates)
- Business metrics (incidents/day, MTTR)
- AI metrics (LLM token usage, hypothesis accuracy)

---

### Logging: Structured Logging (JSON)

**Choice:** Python `logging` + JSON formatter

**Rationale:**
- Native Python library
- JSON format for parsing
- Integration with Azure Monitor

**Library:** `python-json-logger`

**Alternative:** ELK Stack (overkill for MVP)

---

### Tracing: OpenTelemetry (Phase 2)

**Choice:** OpenTelemetry (future)

**Rationale:**
- Vendor-neutral
- Rich ecosystem
- Future-proof

**Not in Phase 1 MVP**

---

## Testing Stack

### Backend Testing

**Choice:**
- **pytest**: Test framework
- **pytest-asyncio**: Async tests
- **pytest-django**: Django integration
- **pytest-cov**: Coverage
- **httpx**: Async HTTP client for API tests

**Rationale:**
- pytest is Python standard
- Excellent fixtures and plugins
- Async support

---

### Frontend Testing

**Choice:**
- **Vitest**: Unit/integration tests (faster than Jest)
- **React Testing Library**: Component tests
- **Playwright** (Phase 2): E2E tests

**Rationale:**
- Vitest is Vite-native, very fast
- RTL encourages accessible, user-centric tests
- Playwright for E2E (better than Cypress)

---

## Development Tools

### Linting & Formatting

**Backend:**
- **Ruff**: Python linter (replaces flake8, isort, etc.)
- **Black**: Code formatter
- **mypy**: Type checking

**Frontend:**
- **ESLint**: JavaScript/TypeScript linter
- **Prettier**: Code formatter

---

### API Documentation

**Choice:** OpenAPI (Swagger UI)

**Rationale:**
- FastAPI auto-generates OpenAPI schema
- Interactive docs at `/docs`
- Client SDK generation possible

---

### Version Control

**Choice:** Git + GitHub

**Branching Strategy:** GitHub Flow
- `main` branch (production)
- Feature branches
- PRs for all changes

---

## Security

### Authentication: Azure AD + JWT

**Choice:**
- **Azure AD**: SSO
- **JWT**: API tokens

**Library:** `python-jose` for JWT

---

### Secret Management: Azure Key Vault

**Choice:** Azure Key Vault

**Rationale:**
- Managed service
- Audit logging
- Automatic rotation
- Integrated with AKS

**Secrets Stored:**
- Database passwords
- API keys (Claude, Pinecone, etc.)
- Integration credentials
- JWT signing keys

---

### Encryption

**At Rest:**
- Azure Database encryption (default)
- Azure Blob Storage encryption (default)

**In Transit:**
- TLS 1.3 everywhere
- Certificate management via Let's Encrypt (or Azure-managed)

---

## Cost Estimates (Phase 1 MVP)

| Service | Estimated Cost/Month |
|---------|---------------------|
| Azure AKS (3 nodes) | $150 |
| Azure Database for PostgreSQL | $100 |
| Azure Cache for Redis | $50 |
| Azure Blob Storage | $10 |
| Claude API (with caching) | $300-800 |
| Pinecone (Starter) | $70 |
| OpenAI Embeddings | $20 |
| Azure Key Vault | $5 |
| **Total** | **$705-1,205/month** |

**Per Tenant:** ~$70-120/month (at 10 tenants)

---

## Technology Decision Matrix

### Must Have (Non-Negotiable)
- ✅ React (user requirement)
- ✅ FastAPI (performance + async)
- ✅ Django ORM (user requirement)
- ✅ PostgreSQL (multi-tenant standard)
- ✅ Azure (user expertise)

### Strongly Preferred
- ✅ Claude API (best reasoning)
- ✅ Kubernetes (scalability)
- ✅ Terraform (IaC)
- ✅ Redis (cache + queue)

### Flexible (Can Change)
- 🟡 Pinecone (could swap for pgvector)
- 🟡 Zustand (could swap for Redux if needed)
- 🟡 GitHub Actions (could use Azure DevOps)

---

## Future Technology Additions (Phase 2+)

### Phase 2
- OpenTelemetry for distributed tracing
- Grafana Loki for log aggregation
- Temporal.io for workflow orchestration

### Phase 3
- Policy engine (custom DSL)
- Multi-cloud support (AWS SDK, GCP SDK)
- Advanced ML models (LSTM for forecasting)

---

## Conclusion

This tech stack is optimized for:
- **Speed**: Async all the way (FastAPI, React 18, Redis)
- **Reliability**: Battle-tested tools (PostgreSQL, Django ORM, K8s)
- **Cost**: Managed services + prompt caching
- **Developer Experience**: TypeScript, modern tooling, great docs
- **Your Requirements**: React + FastAPI + Django ORM + Azure

**Next Steps:**
1. Review and approve stack
2. Set up repositories
3. Create initial project scaffolding
4. Begin Sprint 1 implementation
