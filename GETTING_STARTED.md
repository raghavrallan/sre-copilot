# Getting Started with SRE Copilot POC

This guide will help you run the SRE Copilot proof-of-concept locally using Docker Compose.

## Prerequisites

- Docker Desktop or Docker Engine (20.10+)
- Docker Compose (2.0+)
- Git
- 8GB RAM minimum
- Ports available: 5173, 8000, 8001, 8002, 8003, 8004, 5432, 6379

## Quick Start (5 minutes)

### 1. Clone and Setup

```bash
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

Open your browser to:
- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## Testing the POC

### 1. Register a New Account

1. Go to http://localhost:5173/register
2. Fill in:
   - Organization Name: `Test Company`
   - Full Name: `John Doe`
   - Email: `john@test.com`
   - Password: `password123`
3. Click "Register"

You'll be automatically logged in and redirected to the dashboard.

### 2. Create an Incident

1. Click "Incidents" in the navigation
2. Click "+ New Incident"
3. Fill in:
   - Title: `High CPU usage on payment-api`
   - Description: `CPU usage spiked to 90% after recent deployment`
   - Service Name: `payment-api`
   - Severity: `High`
4. Click "Create Incident"

### 3. View AI-Generated Hypotheses

1. Click on the incident you just created
2. Wait a few seconds for AI to generate hypotheses
3. You'll see 3 hypotheses ranked by confidence score with supporting evidence

**Note**: Since no `ANTHROPIC_API_KEY` is configured, the AI service uses mock data. The mock generates realistic-looking hypotheses to demonstrate the feature.

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
       ├─────────┬─────────┬─────────┬
       ▼         ▼         ▼         ▼
   ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
   │ Auth   │ │Incident│ │   AI   │ │ Integ  │
   │Service │ │Service │ │Service │ │Service │
   │  :8001 │ │  :8002 │ │  :8003 │ │  :8004 │
   └───┬────┘ └───┬────┘ └────────┘ └────────┘
       │          │
       └────┬─────┘
            ▼
     ┌─────────────┐
     │ PostgreSQL  │  Database (Port 5432)
     │   + Redis   │  Cache (Port 6379)
     └─────────────┘
```

## Service Details

### API Gateway (Port 8000)
- Main entry point for all API requests
- Routes to appropriate microservice
- Handles authentication verification
- **Health**: http://localhost:8000/health
- **Docs**: http://localhost:8000/docs

### Auth Service (Port 8001)
- User registration and login
- JWT token generation
- User management
- **Health**: http://localhost:8001/health

### Incident Service (Port 8002)
- Incident CRUD operations
- Manages incident state transitions
- Triggers AI hypothesis generation
- **Health**: http://localhost:8002/health

### AI Service (Port 8003)
- Generates incident hypotheses
- Mock mode (no API key needed)
- Real mode (requires `ANTHROPIC_API_KEY`)
- **Health**: http://localhost:8003/health
- **Status**: http://localhost:8003/status

### Frontend (Port 5173)
- React + TypeScript SPA
- Responsive UI with Tailwind CSS
- Real-time updates

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
1. Check API Gateway is running: http://localhost:8000/health
2. Check browser console for CORS errors
3. Verify `.env` has correct `VITE_API_GATEWAY_URL`

### Migrations not applied
```bash
# Enter auth-service container
docker-compose exec auth-service bash

# Run migrations manually
cd /app
python -c "
import os, sys, django
sys.path.insert(0, '../../..')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'shared.config.settings')
django.setup()
from django.core.management import call_command
call_command('migrate')
"
```

## Development Workflow

### Running Tests

**Backend:**
```bash
# Auth service tests
cd services/auth-service
pip install -r requirements.txt
pytest

# Incident service tests
cd services/incident-service
pytest
```

**Frontend:**
```bash
cd frontend
npm install
npm run test
```

### Hot Reload

All services are configured with hot reload:
- **Backend**: Edit Python files, uvicorn auto-reloads
- **Frontend**: Edit React files, Vite auto-reloads

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service

# Last 100 lines
docker-compose logs --tail=100 incident-service
```

### Stopping Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clears database)
docker-compose down -v
```

## API Examples

### Register User

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
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
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Create Incident (requires token)

```bash
TOKEN="your-jwt-token-here"

curl -X POST http://localhost:8000/api/v1/incidents \
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
curl -X GET http://localhost:8000/api/v1/incidents \
  -H "Authorization: Bearer $TOKEN"
```

## Next Steps

1. **Add Real AI**: Set `ANTHROPIC_API_KEY` in `.env` to use Claude API
2. **Add More Services**: Integration service for Prometheus, PagerDuty
3. **Customize UI**: Modify React components in `frontend/src`
4. **Add Features**: Runbooks, timelines, notifications
5. **Deploy**: Use Kubernetes manifests in `infra/kubernetes`

## Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review documentation in `docs/`
3. Create GitHub issue

## Clean Up

To completely remove all containers, networks, and volumes:

```bash
docker-compose down -v
docker system prune -a
```

---

**POC Ready!** You now have a fully functional SRE Copilot microservices application running locally. 🚀
