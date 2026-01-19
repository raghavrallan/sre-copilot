# SRE Copilot - Quick Reference Card

## 🚀 Quick Start (3 Commands)

```bash
cp .env.example .env
docker-compose up -d
python scripts/migrate.py
```

**Open:** http://localhost:5173

---

## 📊 Service URLs

| Service | URL | Docs |
|---------|-----|------|
| **Frontend** | http://localhost:5173 | - |
| **API Gateway** | http://localhost:8000 | http://localhost:8000/docs |
| **Auth Service** | http://localhost:8001 | http://localhost:8001/docs |
| **Incident Service** | http://localhost:8002 | http://localhost:8002/docs |
| **AI Service** | http://localhost:8003 | http://localhost:8003/docs |
| **PostgreSQL** | localhost:5432 | - |
| **Redis** | localhost:6379 | - |

---

## 🔧 Common Commands

### Start/Stop
```bash
docker-compose up -d          # Start all services
docker-compose down           # Stop all services
docker-compose down -v        # Stop and remove volumes
docker-compose restart <svc>  # Restart specific service
```

### Logs
```bash
docker-compose logs -f                    # All services
docker-compose logs -f auth-service       # Specific service
docker-compose logs --tail=100 ai-service # Last 100 lines
```

### Database
```bash
# Run migrations
python scripts/migrate.py

# Connect to PostgreSQL
docker-compose exec postgres psql -U sre_user -d sre_copilot

# Common queries
SELECT * FROM tenants;
SELECT * FROM users;
SELECT * FROM incidents;
SELECT * FROM hypotheses;
```

### Health Checks
```bash
curl http://localhost:8000/health              # Gateway
curl http://localhost:8000/health/services     # All services
curl http://localhost:8003/status              # AI service status
```

---

## 🧪 Testing

### Backend Tests
```bash
cd services/auth-service && pytest
cd services/incident-service && pytest
```

### Frontend Tests
```bash
cd frontend && npm run test
cd frontend && npm run test:coverage
```

### API Tests
```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123","full_name":"Test User","tenant_name":"Test Org"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Create Incident (replace TOKEN)
curl -X POST http://localhost:8000/api/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer TOKEN" \
  -d '{"title":"High CPU","description":"CPU at 90%","service_name":"api","severity":"high"}'
```

---

## 📂 Key Files

### Configuration
- `.env` - Environment variables
- `docker-compose.yml` - Service orchestration
- `shared/config/settings.py` - Django settings

### Backend
- `services/*/app/main.py` - Service entry points
- `services/*/app/api/*.py` - API endpoints
- `shared/models/*.py` - Database models

### Frontend
- `frontend/src/App.tsx` - Main app
- `frontend/src/pages/*.tsx` - Page components
- `frontend/src/lib/stores/auth-store.ts` - Auth state

### Documentation
- `GETTING_STARTED.md` - Detailed setup guide
- `POC_COMPLETE.md` - Complete test guide
- `FOLDER_STRUCTURE.md` - Architecture details

---

## 🐛 Troubleshooting

### Services won't start
```bash
docker-compose logs -f
docker-compose down && docker-compose up -d --build
```

### Database errors
```bash
docker-compose exec postgres psql -U sre_user -d sre_copilot
\dt  # List tables
```

### Frontend blank page
```bash
docker-compose logs frontend
# Check browser console (F12)
curl http://localhost:8000/health
```

### Port already in use
```bash
# Windows
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# Linux/Mac
lsof -ti:8000 | xargs kill -9
```

---

## 🔑 Default Credentials

**Test User:**
- Email: `john@test.com`
- Password: `password123`
- Tenant: `Test Company`

**Database:**
- User: `sre_user`
- Password: `sre_password`
- Database: `sre_copilot`

---

## 📊 Architecture Flow

```
Browser → Frontend (React)
    ↓
API Gateway (8000)
    ↓
Auth Service (8001) ← JWT validation
    ↓
Incident Service (8002)
    ↓
AI Service (8003) ← Generate hypotheses
    ↓
PostgreSQL (5432) ← Save data
```

---

## 🎯 Demo Scenario

1. **Register**: http://localhost:5173/register
2. **Create Incident**: "High CPU on payment-api"
3. **View Details**: Click incident → See AI hypotheses
4. **Verify**: 3 hypotheses with confidence scores

**Expected Result:**
- Hypotheses ranked #1, #2, #3
- Confidence scores (e.g., 85%, 72%, 65%)
- Supporting evidence for each

---

## 📝 Key Metrics

**Services:** 8 containers
**Languages:** Python, TypeScript
**Frameworks:** FastAPI, React
**Database:** PostgreSQL + Redis
**Tests:** Unit + Integration
**CI/CD:** GitHub Actions

---

## 🚦 Status Checks

```bash
# All services healthy?
docker-compose ps

# Database tables created?
docker-compose exec postgres psql -U sre_user -d sre_copilot -c "\dt"

# Frontend accessible?
curl -I http://localhost:5173

# API working?
curl http://localhost:8000/health/services
```

---

## 📚 Documentation Hierarchy

1. **QUICK_REFERENCE.md** ← You are here
2. **GETTING_STARTED.md** - Setup guide (10 min)
3. **POC_COMPLETE.md** - Test guide (30 min)
4. **FOLDER_STRUCTURE.md** - Architecture (deep dive)
5. **README.md** - Project overview

---

## 🎓 Next Steps

- [ ] Follow `GETTING_STARTED.md`
- [ ] Run through `POC_COMPLETE.md` test scenarios
- [ ] Explore API docs at `/docs`
- [ ] Modify React components
- [ ] Add custom incidents
- [ ] Review `FOLDER_STRUCTURE.md`

---

**Need Help?** Check the logs first:
```bash
docker-compose logs -f
```

**Want to reset everything?**
```bash
docker-compose down -v
docker-compose up -d
python scripts/migrate.py
```

---

**🎉 Happy Testing!**
