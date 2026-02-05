# Getting Started with SRE Copilot

**Last Updated:** 2026-02-01

This guide will help you run the SRE Copilot platform locally using Docker Compose.

---

## Prerequisites

- **Docker Desktop** or Docker Engine (20.10+)
- **Docker Compose** (2.0+)
- **Git**
- **8GB RAM** minimum
- **Available Ports:** 5173, 8000, 8001, 8002, 8003, 8004, 8005, 8008, 5432, 6379

---

## Quick Start (5 minutes)

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/sre-copilot.git
cd sre-copilot
cp .env.example .env
```

### 2. Start All Services

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database (port 5432)
- Redis cache (port 6379)
- API Gateway (port 8000)
- Auth Service (port 8001)
- Incident Service (port 8002)
- AI Service (port 8003)
- Integration Service (port 8004)
- WebSocket Service (port 8005)
- Audit Service (port 8008)
- Frontend (port 5173)

### 3. Initialize Database

Run Django migrations to create database tables:

```bash
# Option 1: Run from host (requires Python 3.11+)
python scripts/migrate.py

# Option 2: Run inside auth-service container
docker-compose exec auth-service python -c "
import os, sys, django
sys.path.insert(0, '/app/../../..')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
django.setup()
from django.core.management import call_command
call_command('makemigrations')
call_command('migrate')
"
```

### 4. Access the Application

- **Frontend:** http://localhost:5173
- **API Docs:** http://localhost:8580/docs
- **Health Check:** http://localhost:8580/health

---

## Service URLs

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:5173 | React UI |
| API Gateway | http://localhost:8580 | Main API entry |
| API Docs | http://localhost:8580/docs | Swagger UI |
| Auth Service | http://localhost:8501 | Authentication |
| Incident Service | http://localhost:8502 | Incident management |
| AI Service | http://localhost:8503 | AI hypotheses |
| Integration Service | http://localhost:8504 | Webhooks |
| WebSocket Service | http://localhost:8505 | Real-time updates |
| Audit Service | http://localhost:8508 | Audit logging |

---

## Testing the Platform

### 1. Register a New Account

1. Go to http://localhost:5173/register
2. Fill in:
   - **Organization Name:** `Test Company`
   - **Full Name:** `John Doe`
   - **Email:** `john@test.com`
   - **Password:** `password123`
3. Click "Register"

You'll be automatically logged in and redirected to the dashboard.

### 2. Create an Incident

1. Click "Incidents" in the navigation
2. Click "+ New Incident"
3. Fill in:
   - **Title:** `High CPU usage on payment-api`
   - **Description:** `CPU spiked to 90% after recent deployment`
   - **Service Name:** `payment-api`
   - **Severity:** `High`
4. Click "Create Incident"

### 3. View AI-Generated Hypotheses

1. Click on the incident you just created
2. Wait a few seconds for AI to generate hypotheses
3. You'll see 3-5 hypotheses ranked by confidence score with supporting evidence

---

## Architecture Overview

```
┌─────────────┐
│  Frontend   │  React + TypeScript (Port 5173)
│  (Vite)     │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ API Gateway │  FastAPI (Port 8000)
│             │  Routes requests to services
└──────┬──────┘
       │
       ├─────────┬─────────┬─────────┬─────────┐
       ▼         ▼         ▼         ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Auth   │ │Incident│ │   AI   │ │ Integ  │ │WebSocket│
   │Service │ │Service │ │Service │ │Service │ │Service │
   │  :8501 │ │  :8502 │ │  :8503 │ │  :8504 │ │  :8505 │
   └───┬────┘ └───┬────┘ └────────┘ └────────┘ └────────┘
       │          │
       └────┬─────┘
            ▼
     ┌─────────────┐
     │ PostgreSQL  │  Database (Port 5432)
     │   + Redis   │  Cache (Port 6379)
     └─────────────┘
```

---

## Development Workflow

### Hot Reload

All services are configured with hot reload:
- **Backend:** Edit Python files, uvicorn auto-reloads
- **Frontend:** Edit React files, Vite auto-reloads

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service

# Last 100 lines
docker-compose logs --tail=100 incident-service
```

### Running Tests

**Backend:**
```bash
cd services/auth-service
pip install -r requirements.txt
pytest

cd services/incident-service
pytest
```

**Frontend:**
```bash
cd frontend
npm install
npm run test
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

---

## Troubleshooting

### Services won't start

```bash
# Check logs
docker-compose logs -f

# Restart specific service
docker-compose restart auth-service

# Rebuild and restart
docker-compose up -d --build
```

### Database connection errors

```bash
# Check if PostgreSQL is healthy
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

### Frontend can't connect to API

1. Check API Gateway is running: http://localhost:8580/health
2. Check browser console for CORS errors
3. Verify `.env` has correct `VITE_API_GATEWAY_URL`

### Port already in use

```bash
# Windows
netstat -ano | findstr :8580
taskkill /PID <pid> /F

# Linux/Mac
lsof -ti:8580 | xargs kill -9
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
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Create Incident

```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:8580/api/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "title": "High CPU usage",
    "description": "CPU spiked to 90%",
    "service_name": "payment-api",
    "severity": "high"
  }'
```

### List Incidents

```bash
curl -X GET http://localhost:8580/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

1. **Add Real AI:** Set `ANTHROPIC_API_KEY` or Azure OpenAI credentials in `.env`
2. **Connect Monitoring:** Set up Prometheus/AlertManager integration
3. **Customize UI:** Modify React components in `frontend/src`
4. **Add Features:** Runbooks, timelines, notifications
5. **Deploy:** Use Kubernetes manifests in `infra/kubernetes`

---

## Related Documentation

- [System Architecture](../architecture/system-architecture.md)
- [API Specifications](../api-specs/README.md)
- [Testing Guide](./testing.md)
- [Technology Choices](../tech-stack/technology-choices.md)
