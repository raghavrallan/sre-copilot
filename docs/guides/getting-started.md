# Getting Started with SRE Copilot

This guide will help you run the SRE Copilot platform locally using Docker Compose.

---

## Prerequisites

- **Docker Desktop** (or Docker Engine 20.10+ with Compose v2)
- **Git**
- **PostgreSQL 13+** -- an external PostgreSQL instance (not included in Docker Compose)
- **8 GB RAM** minimum
- **Available Ports:** 3000, 8580, 8505

---

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/raghavrallan/sre-copilot.git
cd sre-copilot
cp .env.example .env
```

Edit `.env` with your actual values:

```bash
# Database -- point to your PostgreSQL instance
POSTGRES_HOST=your-postgres-host
POSTGRES_PORT=5432
POSTGRES_DB=srecopilot
POSTGRES_USER=srecopilot
POSTGRES_PASSWORD=your-password

# Redis (runs inside Docker)
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY=change-me-to-a-random-string
JWT_ALGORITHM=HS256

# Azure OpenAI (optional -- AI features require this)
AZURE_OPENAI_ENDPOINT=https://your-endpoint.cognitiveservices.azure.com/
AZURE_OPENAI_API_KEY=your-key
AZURE_OPENAI_DEPLOYMENT=gpt-4o-mini

# Frontend
VITE_API_GATEWAY_URL=http://localhost:8580
VITE_WEBSOCKET_URL=ws://localhost:8505
```

### 2. Start All Services

```bash
docker compose up -d
```

This starts 15 containers:

| Service | Internal Port | Description |
|---------|--------------|-------------|
| api-gateway | 8500 (ext 8580) | API routing, auth verification |
| auth-service | 8501 | Authentication, RBAC |
| incident-service | 8502 | Incident management |
| ai-service | 8503 | AI hypothesis generation |
| integration-service | 8504 | Prometheus/AlertManager webhooks |
| websocket-service | 8505 (ext 8505) | Real-time WebSocket updates |
| audit-service | 8508 | Audit logging |
| metrics-collector-service | 8509 | Metrics, traces, errors, dashboards, SLOs |
| log-service | 8510 | Log ingestion and search |
| alerting-service | 8511 | Alert policies and evaluation |
| synthetic-service | 8512 | HTTP health monitors |
| security-service | 8513 | Vulnerability tracking |
| cloud-connector-service | 8514 | AWS/Azure/GCP sync |
| cicd-connector-service | 8515 | GitHub/Azure DevOps CI/CD |
| frontend | 3000 (ext 3000) | React UI |

Plus a **Redis** container for caching and pub/sub.

### 3. Access the Application

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Frontend UI |
| http://localhost:8580 | API Gateway |
| http://localhost:8580/docs | Swagger API Documentation |
| ws://localhost:8505/ws | WebSocket endpoint |

### 4. Register a New Account

1. Open http://localhost:3000/register
2. Fill in:
   - **Organization Name:** Your company name
   - **Full Name:** Your name
   - **Email:** your@email.com
   - **Password:** A strong password
3. Click **Register**

You will be logged in automatically and redirected to the dashboard.

---

## Architecture Overview

```
┌──────────────┐           ┌──────────────┐
│   Frontend   │◀──WS──────│  WebSocket   │
│   (React)    │           │   Service    │
│   :3000      │           │   :8505      │
└──────┬───────┘           └──────┬───────┘
       │                          │
       ▼                          │
┌──────────────┐                  │
│ API Gateway  │◀─────────────────┘
│   :8580      │
└──────┬───────┘
       │
       ├──────┬──────┬──────┬──────┬──────┬──────┬──────┐
       ▼      ▼      ▼      ▼      ▼      ▼      ▼      ▼
    Auth  Incident  AI   Integ  Metrics  Logs  Alert  ...more
    :8501  :8502  :8503  :8504  :8509   :8510  :8511
       │      │                   │       │
       └──────┴───────────────────┴───────┘
                       │
              ┌────────┴────────┐
              │   PostgreSQL    │   (external)
              │   + Redis       │   (containerized)
              └─────────────────┘
```

---

## Development Workflow

### Hot Reload

All services have hot reload enabled:
- **Backend:** Edit Python files in `services/` or `shared/` -- uvicorn auto-reloads
- **Frontend:** Edit React files in `frontend/src/` -- Vite auto-reloads

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api-gateway

# Last 50 lines
docker compose logs --tail=50 metrics-collector-service
```

### Rebuilding a Service

After changing `requirements.txt` or `Dockerfile`:

```bash
docker compose up --build -d <service-name>
```

### Stopping Services

```bash
docker compose down
```

---

## API Examples

### Register User

```bash
curl -X POST http://localhost:8580/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "full_name": "Test User",
    "tenant_name": "Test Org"
  }'
```

### Login

```bash
curl -X POST http://localhost:8580/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### List Incidents (authenticated)

```bash
curl http://localhost:8580/api/v1/incidents \
  -b cookies.txt
```

### Ingest Metrics (API key auth)

```bash
curl -X POST http://localhost:8580/api/v1/ingest/metrics \
  -H "X-API-Key: your-project-api-key" \
  -H "Content-Type: application/json" \
  -d '{"metrics": [{"name": "cpu_usage", "value": 72.5, "tags": {"host": "web-01"}}]}'
```

---

## Troubleshooting

### Services won't start

```bash
docker compose logs -f <service-name>
docker compose up --build -d <service-name>
```

### Database connection errors

Verify your `.env` has the correct `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, and `POSTGRES_PASSWORD`. The database is external -- Docker containers must be able to reach it over the network.

### Frontend can't connect to API

1. Check API Gateway: http://localhost:8580/health
2. Verify `.env` has `VITE_API_GATEWAY_URL=http://localhost:8580`

### WebSocket shows "Offline"

1. Check WebSocket service: http://localhost:8505/health
2. Verify `.env` has `VITE_WEBSOCKET_URL=ws://localhost:8505`
3. Hard-refresh the browser (Ctrl+Shift+R) to reset the reconnect counter

### Port already in use

```bash
# Windows
netstat -ano | findstr :8580
taskkill /PID <pid> /F

# Linux / Mac
lsof -ti:8580 | xargs kill -9
```

---

## Next Steps

- **[System Architecture](../architecture/system-architecture.md)** -- Understand the full system design
- **[API Reference](../api-specs/README.md)** -- Explore all API endpoints
- **[Testing Guide](./testing.md)** -- Run the test suite
- **[Security Guide](./security.md)** -- Security best practices
