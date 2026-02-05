# SRE Copilot - Complete Folder Structure

## Overview

This document describes the complete microservices architecture folder structure for the SRE Copilot POC.

## Root Structure

```
sre-copilot/
├── .github/                      # GitHub Actions CI/CD
│   └── workflows/
│       ├── backend-ci.yml        # Backend testing & build
│       └── frontend-ci.yml       # Frontend testing & build
│
├── services/                     # Microservices
│   ├── api-gateway/             # Main API Gateway (Port 8000)
│   ├── auth-service/            # Authentication Service (Port 8001)
│   ├── incident-service/        # Incident Management (Port 8002)
│   ├── ai-service/              # AI/Hypothesis Generation (Port 8003)
│   └── integration-service/     # External Integrations (Port 8004)
│
├── shared/                       # Shared code across services
│   ├── config/                  # Django settings
│   ├── models/                  # Django ORM models
│   └── utils/                   # Shared utilities
│
├── frontend/                     # React Frontend (Port 5173)
│   ├── src/
│   ├── public/
│   └── tests/
│
├── infra/                        # Infrastructure as Code
│   ├── terraform/               # Terraform configs
│   ├── kubernetes/              # K8s manifests
│   └── scripts/                 # Deployment scripts
│
├── docs/                         # Documentation
│   ├── architecture/
│   ├── features/
│   ├── data-models/
│   ├── tech-stack/
│   └── api-specs/
│
├── sprints/                      # Sprint planning
│   ├── phase-1/
│   ├── phase-2/
│   └── phase-3/
│
├── diagrams/                     # Architecture diagrams
├── scripts/                      # Utility scripts
│
├── docker-compose.yml           # Local development setup
├── .env.example                 # Environment variables template
├── README.md                    # Main documentation
└── GETTING_STARTED.md          # Quick start guide
```

## Microservices Detail

### 1. API Gateway (`services/api-gateway/`)

```
api-gateway/
├── Dockerfile                   # Docker build instructions
├── requirements.txt            # Python dependencies
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app entry point
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   ├── health.py           # Health checks
│   │   └── proxy.py            # Proxy to other services
│   ├── core/                   # Core functionality
│   │   ├── __init__.py
│   │   └── config.py           # Configuration
│   └── tests/                  # Unit tests
│       ├── unit/
│       └── integration/
└── tests/                      # Additional tests
```

**Responsibilities:**
- Main entry point for all API requests
- Routes requests to appropriate microservices
- Authentication verification (delegates to auth-service)
- Rate limiting and request logging
- Service health aggregation

**Key Endpoints:**
- `GET /` - API info
- `GET /health` - Health check
- `GET /health/services` - All services health
- `POST /api/v1/auth/*` - Auth endpoints (proxied)
- `GET /api/v1/incidents` - Incidents endpoints (proxied)

---

### 2. Auth Service (`services/auth-service/`)

```
auth-service/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI app
│   ├── api/                    # API routes
│   │   ├── __init__.py
│   │   └── auth.py             # Auth endpoints
│   ├── core/                   # Core functionality
│   │   ├── __init__.py
│   │   ├── config.py           # Settings
│   │   └── security.py         # JWT & password hashing
│   └── tests/
│       ├── unit/
│       │   └── test_auth.py
│       └── integration/
└── tests/
```

**Responsibilities:**
- User registration and login
- JWT token generation and validation
- Password hashing (bcrypt)
- Tenant creation
- User management

**Key Endpoints:**
- `POST /register` - Register new user + tenant
- `POST /login` - Login and get JWT token
- `GET /verify` - Verify JWT token
- `GET /me` - Get current user info

**Database Models Used:**
- `Tenant` - Organization/company
- `User` - User accounts

---

### 3. Incident Service (`services/incident-service/`)

```
incident-service/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── incidents.py        # Incident CRUD
│   └── tests/
│       ├── unit/
│       │   └── test_incidents.py
│       └── integration/
└── tests/
```

**Responsibilities:**
- Incident CRUD operations
- Incident state management
- Triggers AI hypothesis generation
- Hypothesis retrieval
- Incident timeline tracking

**Key Endpoints:**
- `GET /incidents` - List all incidents
- `POST /incidents` - Create new incident
- `GET /incidents/{id}` - Get incident details
- `GET /incidents/{id}/hypotheses` - Get hypotheses
- `PATCH /incidents/{id}/state` - Update state

**Database Models Used:**
- `Incident` - Production incidents
- `Hypothesis` - AI-generated hypotheses

---

### 4. AI Service (`services/ai-service/`)

```
ai-service/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   ├── api/
│   │   ├── __init__.py
│   │   └── ai.py               # AI endpoints
│   └── tests/
│       └── unit/
└── tests/
```

**Responsibilities:**
- Generate incident hypotheses using Claude API
- Mock hypothesis generation (when no API key)
- Confidence scoring
- Evidence aggregation
- AI service health monitoring

**Key Endpoints:**
- `POST /generate-hypotheses` - Generate hypotheses for incident
- `GET /status` - AI service status (mock vs real)

**Features:**
- **Mock Mode**: Generates realistic fake hypotheses (no API key needed)
- **Real Mode**: Uses Claude API for actual AI generation
- **Automatic Fallback**: Falls back to mock if API fails

---

### 5. Integration Service (`services/integration-service/`)

```
integration-service/
├── Dockerfile
├── requirements.txt
├── app/
│   ├── __init__.py
│   ├── main.py
│   └── api/
│       └── integrations.py     # Integration endpoints
└── tests/
```

**Responsibilities:**
- Prometheus metrics integration
- PagerDuty webhook receiver
- External API integrations
- Integration health monitoring

**Status:** Basic structure created, endpoints to be implemented

---

## Shared Components (`shared/`)

```
shared/
├── __init__.py
├── config/
│   ├── __init__.py
│   └── settings.py             # Django settings
├── models/                     # Django ORM models
│   ├── __init__.py
│   ├── tenant.py               # Tenant & User models
│   └── incident.py             # Incident & Hypothesis models
└── utils/
    ├── __init__.py
    └── database.py             # DB utilities
```

**Purpose:**
- Shared Django ORM models used by all services
- Shared configuration
- Shared utility functions
- Single source of truth for data models

**Key Models:**
- `Tenant` - Multi-tenant root entity
- `User` - User accounts
- `Incident` - Production incidents
- `Hypothesis` - AI-generated hypotheses

---

## Frontend (`frontend/`)

```
frontend/
├── Dockerfile                  # Multi-stage build (dev + prod)
├── package.json                # Dependencies
├── tsconfig.json               # TypeScript config
├── tailwind.config.js          # Tailwind CSS config
├── vite.config.ts              # Vite config
├── index.html                  # Entry HTML
│
├── src/
│   ├── main.tsx                # React entry point
│   ├── App.tsx                 # Main app component
│   ├── index.css               # Global styles
│   │
│   ├── components/             # Reusable components
│   │   ├── ui/                 # UI components (shadcn)
│   │   ├── features/           # Feature-specific components
│   │   └── Layout.tsx          # Main layout
│   │
│   ├── pages/                  # Page components
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── IncidentsPage.tsx
│   │   └── IncidentDetailPage.tsx
│   │
│   ├── lib/                    # Libraries & utilities
│   │   └── stores/
│   │       └── auth-store.ts   # Zustand auth store
│   │
│   ├── services/               # API services
│   │   └── api.ts              # Axios API client
│   │
│   ├── types/                  # TypeScript types
│   │   └── incident.ts
│   │
│   └── tests/                  # Tests
│       ├── setup.ts
│       ├── unit/
│       │   └── LoginPage.test.tsx
│       └── integration/
│
└── public/                     # Static assets
```

**Tech Stack:**
- React 18 + TypeScript
- Vite (build tool)
- React Router (routing)
- Zustand (state management)
- Axios (HTTP client)
- Tailwind CSS (styling)
- Vitest (testing)

**Key Features:**
- Authentication (login/register)
- Dashboard with recent incidents
- Incident list and creation
- Incident detail with AI hypotheses
- Responsive design

---

## Infrastructure (`infra/`)

```
infra/
├── terraform/                  # Infrastructure as Code
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
├── kubernetes/                 # K8s manifests
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   └── ingress/
│
└── scripts/                    # Deployment scripts
    └── deploy.sh
```

**Status:** Placeholder structure for future deployment

---

## Documentation (`docs/`)

Comprehensive documentation for all aspects:

- `architecture/` - System architecture diagrams
- `features/` - Feature specifications (Phase 1, 2, 3)
- `data-models/` - Database schema
- `tech-stack/` - Technology choices
- `api-specs/` - API documentation

---

## CI/CD (`.github/workflows/`)

### Backend CI (`backend-ci.yml`)
- Runs on push to `main` or `develop`
- Tests auth-service and incident-service
- Runs linters (ruff, black)
- Builds Docker images

### Frontend CI (`frontend-ci.yml`)
- Runs on push to `main` or `develop`
- Lints TypeScript code
- Runs unit tests with coverage
- Builds production bundle
- Builds Docker image

---

## Key Files

### Root Level

- `docker-compose.yml` - Local development orchestration
- `.env.example` - Environment variables template
- `README.md` - Main project documentation
- `GETTING_STARTED.md` - Quick start guide
- `PROJECT-SUMMARY.md` - Executive summary

### Scripts

- `scripts/migrate.py` - Django database migrations
- `scripts/init-db.sql` - PostgreSQL initialization

---

## Database Schema

All models defined in `shared/models/`:

**Tables:**
- `tenants` - Organizations
- `users` - User accounts
- `incidents` - Production incidents
- `hypotheses` - AI-generated hypotheses

**Relationships:**
```
Tenant (1) ──< (*) User
           └──< (*) Incident ──< (*) Hypothesis
```

---

## Port Allocation

| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 5173 | React development server |
| API Gateway | 8000 | Main API entry point |
| Auth Service | 8001 | Authentication |
| Incident Service | 8002 | Incident management |
| AI Service | 8003 | AI/hypothesis generation |
| Integration Service | 8004 | External integrations |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache & queue |

---

## Technology Stack Summary

### Backend
- **Language:** Python 3.11+
- **Framework:** FastAPI
- **ORM:** Django ORM
- **Database:** PostgreSQL 15
- **Cache:** Redis 7
- **AI:** Claude API (Anthropic) / Mock

### Frontend
- **Language:** TypeScript
- **Framework:** React 18
- **Build Tool:** Vite
- **State:** Zustand
- **Styling:** Tailwind CSS
- **Testing:** Vitest

### DevOps
- **Containerization:** Docker
- **Orchestration:** Docker Compose (local), Kubernetes (prod)
- **CI/CD:** GitHub Actions
- **IaC:** Terraform

---

## Development Workflow

1. **Clone Repository**
2. **Copy `.env.example` to `.env`**
3. **Start Services**: `docker-compose up -d`
4. **Run Migrations**: `python scripts/migrate.py`
5. **Access Frontend**: http://localhost:5173
6. **Access API Docs**: http://localhost:8580/docs

All services have hot-reload enabled for development.

---

## Testing Strategy

### Backend
- Unit tests with pytest
- Integration tests with TestClient
- Coverage reporting
- Linting with ruff and black

### Frontend
- Unit tests with Vitest
- Component tests with Testing Library
- Type checking with TypeScript
- E2E tests with Playwright (future)

---

This folder structure follows microservices best practices with clear separation of concerns, independent deployability, and comprehensive testing.
