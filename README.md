# SRE Copilot

**AI-Powered Operational Intelligence for Site Reliability Engineering**

---

## Overview

SRE Copilot is an AI-powered platform that understands, predicts, and acts on production systems with graduated autonomy. It bridges observability tools and incident management with intelligent automation, helping SRE teams reduce MTTR, alert fatigue, and operational toil.

**Not competing with:** Datadog, New Relic, PagerDuty
**Competing with:** Manual runbooks, tribal knowledge, alert fatigue, toil

---

## Vision

Build a comprehensive SRE AI platform in three phases:

### Phase 1: Intelligence Layer (Months 1-4) ⬅️ **WE ARE HERE**
**Goal:** Earn trust through incident sensemaking

**Core Capabilities:**
- Incident context assistant (Slack/Teams bot)
- AI-powered hypothesis generation
- Runbook recommendation engine
- Root cause analysis assistant
- Automated post-mortem generation

**Success Metric:** 60% of incidents start with "asking the AI"

---

### Phase 2: Predictive Layer (Months 5-9)
**Goal:** Shift from reactive to proactive

**Core Capabilities:**
- Anomaly detection with explainability
- Predictive alerting (3-12 hour forecast)
- Smart alert correlation/suppression
- Capacity forecasting
- Weekly insight reports

**Success Metric:** 40% reduction in surprise incidents, 70% alert noise reduction

---

### Phase 3: Autonomous Layer (Months 10-15)
**Goal:** Delegate safe toil to AI

**Core Capabilities:**
- Graduated autonomous remediation
- Cost optimization automation
- Infrastructure drift correction
- Compliance monitoring
- Self-healing workflows

**Success Metric:** 15 hours/week toil reduction per engineer, 25% infrastructure cost savings

---

## Technology Stack

### Backend
- **API Framework:** FastAPI (Python 3.11+)
- **ORM:** Django ORM (standalone)
- **Database:** PostgreSQL 15+ with TimescaleDB
- **Cache/Queue:** Redis 7+
- **AI:** Claude Sonnet 4.5 (Anthropic) with prompt caching
- **Vector DB:** Pinecone
- **ML:** Prophet (forecasting), Isolation Forest (anomaly detection)

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **UI Library:** shadcn/ui + Tailwind CSS
- **State Management:** Zustand
- **Charts:** Recharts + D3.js

### Infrastructure
- **Cloud:** Microsoft Azure
- **Orchestration:** Kubernetes (AKS)
- **IaC:** Terraform
- **CI/CD:** GitHub Actions
- **Monitoring:** Prometheus + Grafana

### Integrations
- **Phase 1:** Prometheus, PagerDuty, Slack
- **Phase 2+:** Datadog, Grafana, Jira, GitHub, etc.

See [Technology Choices](docs/tech-stack/technology-choices.md) for detailed rationale.

---

## Project Structure

```
sre-copilot/
├── README.md                          # This file
├── FOLDER_STRUCTURE.md                # Detailed folder structure
├── docs/                              # All documentation
│   ├── architecture/                  # System architecture
│   │   ├── system-architecture.md     # Full system architecture
│   │   └── data-flow.md               # Data flow diagrams
│   ├── api-specs/                     # API specifications
│   │   ├── README.md                  # Complete API reference
│   │   └── webhooks.md                # Webhook specifications
│   ├── guides/                        # Developer guides
│   │   ├── getting-started.md         # Quick start guide
│   │   ├── testing.md                 # Testing guide
│   │   └── security.md                # Security guide
│   ├── features/
│   │   └── phase-1-v1-features.md     # Phase 1 feature specifications
│   ├── data-models/
│   │   └── core-models.md             # Database schema
│   └── tech-stack/
│       └── technology-choices.md      # Tech stack decisions
│
├── services/                          # Microservices
│   ├── api-gateway/                   # API Gateway (Port 8000)
│   ├── auth-service/                  # Authentication (Port 8001)
│   ├── incident-service/              # Incidents (Port 8002)
│   ├── ai-service/                    # AI/ML (Port 8003)
│   ├── integration-service/           # Webhooks (Port 8004)
│   ├── websocket-service/             # Real-time (Port 8005)
│   └── audit-service/                 # Audit logs (Port 8008)
│
├── frontend/                          # React + TypeScript (Port 5173)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── services/
│   └── public/
│
├── shared/                            # Shared code
│   ├── models/                        # Django ORM models
│   ├── migrations/                    # Database migrations
│   └── config/                        # Shared configuration
│
├── infra/                             # Infrastructure
│   ├── terraform/                     # IaC
│   └── kubernetes/                    # K8s manifests
│
├── tests/                             # Test suites
│   ├── unit/                          # Unit tests
│   └── integration/                   # Integration tests
│
├── diagrams/                          # Architecture diagrams
│   └── complete-architecture.md
│
└── docker-compose.yml                 # Local development setup
```

---

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL 15+
- Azure subscription (for deployment)

### Local Development Setup

```bash
# Clone repository
git clone https://github.com/your-org/sre-copilot.git
cd sre-copilot

# Backend setup
cd backend
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt

# Django migrations
python manage.py migrate

# Start backend
uvicorn app.main:app --reload

# Frontend setup (in new terminal)
cd frontend
npm install
npm run dev
```

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

**Services:**
- API: http://localhost:8000
- Frontend: http://localhost:5173
- API Docs: http://localhost:8000/docs
- PostgreSQL: localhost:5432
- Redis: localhost:6379

---

## Documentation

### Getting Started
- **[Getting Started Guide](docs/guides/getting-started.md)** - Quick start with Docker Compose
- [Technology Choices](docs/tech-stack/technology-choices.md) - Tech stack rationale

### Architecture
- [System Architecture](docs/architecture/system-architecture.md) - Complete system architecture
- [Data Flow](docs/architecture/data-flow.md) - Data flow diagrams
- [Architecture Diagrams](diagrams/complete-architecture.md) - ASCII diagrams

### API Reference
- [API Specifications](docs/api-specs/README.md) - Complete REST API reference
- [Webhook API](docs/api-specs/webhooks.md) - AlertManager/Prometheus webhooks

### Features & Data
- [Phase 1 Features](docs/features/phase-1-v1-features.md) - Feature specifications
- [Data Models](docs/data-models/core-models.md) - Django ORM models and schema

### Guides
- [Testing Guide](docs/guides/testing.md) - Testing strategy and commands
- [Security Guide](docs/guides/security.md) - Security features and best practices

---

## Development Roadmap

### ✅ Phase 0: Planning (Complete)
- [x] Architecture design
- [x] Tech stack selection
- [x] Data model design
- [x] Sprint planning
- [x] Documentation

### 🚧 Phase 1: Intelligence Layer (In Progress)

#### Sprint 1: Foundation (Weeks 1-4)
- [ ] Multi-tenant database setup
- [ ] Azure AD authentication
- [ ] Prometheus integration
- [ ] PagerDuty webhook receiver
- [ ] Claude API integration
- [ ] Context assembly engine

#### Sprint 2: Core Engine (Weeks 5-8)
- [ ] Hypothesis confidence scoring
- [ ] Evidence aggregator
- [ ] Slack bot (basic)
- [ ] Incident state machine
- [ ] Incident timeline

#### Sprint 3: Features (Weeks 9-12)
- [ ] Runbook semantic search (Pinecone)
- [ ] RCA assistant
- [ ] Post-mortem auto-generation
- [ ] Natural language queries

#### Sprint 4: Polish (Weeks 13-16)
- [ ] UI/UX improvements
- [ ] Performance optimization
- [ ] Beta customer deployment
- [ ] Documentation polish

### 📅 Phase 2: Predictive Layer (Months 5-9)
- Anomaly detection
- Predictive alerting
- Alert correlation
- Capacity forecasting

### 📅 Phase 3: Autonomous Layer (Months 10-15)
- Autonomous remediation
- Cost optimization
- Infrastructure drift correction
- Self-healing workflows

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
feat: Add hypothesis confidence scoring
fix: Fix PagerDuty webhook parsing
docs: Update architecture diagram
test: Add unit tests for evidence aggregator
chore: Update dependencies
```

### Code Quality

**Backend:**
- Linting: `ruff check .`
- Formatting: `black .`
- Type checking: `mypy app/`
- Tests: `pytest`

**Frontend:**
- Linting: `npm run lint`
- Formatting: `npm run format`
- Tests: `npm run test`

All checks run automatically on PRs via GitHub Actions.

---

## Metrics & KPIs

### Technical Metrics (Phase 1)
- API response time (p95) < 500ms
- Slack notification time (p95) < 60s
- Hypothesis generation < 30s
- System uptime > 99%
- Test coverage > 70%

### Business Metrics (Phase 1)
- Adoption: 60%+ engineers use weekly
- Trust: 70%+ hypotheses marked accurate
- MTTR reduction: 30%
- User satisfaction: NPS > 40

---

## Deployment

### Staging

```bash
# Deploy to staging (via GitHub Actions)
git push origin main

# Or manually
terraform apply -var-file=staging.tfvars
kubectl apply -f k8s/staging/
```

### Production

```bash
# Create release tag
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# GitHub Actions automatically deploys to production
```

See [Deployment Guide](docs/deployment/production-deploy.md) (TBD)

---

## Cost Structure

### Development Phase (Months 1-6)
- Claude API: $300-800/month
- Pinecone: $70/month
- Azure Infrastructure: $500-1,000/month
- **Total:** ~$1,500-2,500/month

### Production (Per Customer)
- Infrastructure: $200-500/month
- Claude API: $100-500/month
- Data Storage: $50-200/month
- **COGS:** $350-1,200/month per customer

### SaaS Pricing
- **Starter:** $499/month (Phase 1, 5 services)
- **Professional:** $1,499/month (Phase 1+2, 20 services)
- **Enterprise:** $4,999/month (All phases, unlimited)

**Margin:** 60-85% at scale

---

## Support & Contact

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/your-org/sre-copilot/issues)
- **Discussions:** [GitHub Discussions](https://github.com/your-org/sre-copilot/discussions)
- **Email:** support@srecopilot.io (TBD)

---

## License

**Proprietary** - All rights reserved

This is commercial software. Unauthorized copying, modification, distribution, or use is strictly prohibited.

Copyright © 2026 SRE Copilot Inc.

---

## Acknowledgments

Built with:
- [FastAPI](https://fastapi.tiangolo.com/)
- [React](https://react.dev/)
- [Django ORM](https://www.djangoproject.com/)
- [Claude API](https://www.anthropic.com/claude)
- [Pinecone](https://www.pinecone.io/)
- [shadcn/ui](https://ui.shadcn.com/)

Inspired by the SRE community's best practices and the vision of AI-augmented operations.

---

**Built with ❤️ for SRE teams worldwide**
