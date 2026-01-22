# SRE Copilot v2.0 - Quick Start Guide

## 🚀 All Services Running!

### Core Services
- **Frontend**: http://localhost:5173
- **API Gateway**: http://localhost:8000
- **Auth Service**: http://localhost:8001
- **Incident Service**: http://localhost:8002
- **AI Service**: http://localhost:8003
- **Integration Service**: http://localhost:8004
- **WebSocket Service**: http://localhost:8005 ⭐ NEW
- **Audit Service**: http://localhost:8008 ⭐ NEW

### Monitoring Stack
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **AlertManager**: http://localhost:9093
- **Dummy App**: http://localhost:8080

---

## 🆕 What's New in v2.0

### 1. WebSocket Real-Time Updates
**Connect to:** `ws://localhost:8005/ws`

**Events you'll receive:**
- `incident.created` - New incidents
- `incident.updated` - Incident status changes
- `hypothesis.generated` - AI hypotheses ready
- `alert.fired` - Prometheus alerts

**Try it:**
```javascript
const ws = new WebSocket('ws://localhost:8005/ws');
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Real-time update:', message);
};
```

### 2. Audit Logging
**Endpoint:** http://localhost:8008

**View audit logs:**
```bash
# Get audit logs
curl "http://localhost:8008/audit-logs?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&limit=10"

# Get user activity
curl "http://localhost:8008/audit-logs/user/{user_id}/activity?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077"

# Get audit statistics
curl "http://localhost:8008/audit-logs/stats?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&days=7"
```

### 3. End-to-End Encryption
**Enable encryption for API responses:**
```bash
# Request with encryption
curl -H "X-Encryption-Enabled: true" http://localhost:8000/api/incidents

# Response will be encrypted:
{
  "encrypted": true,
  "algorithm": "AES-256-GCM",
  "key_id": "...",
  "iv": "...",
  "data": "..."
}
```

### 4. Advanced Alert Rules (25+ new alerts)

**View in Prometheus:**
- http://localhost:9090/alerts

**New alert categories:**
- **Composite Alerts**: ServiceSeverelyDegraded, DatabaseImpactingService
- **Anomaly Detection**: TrafficAnomaly, ErrorRateAnomaly, LatencySpike
- **SLO/SLI Tracking**: AvailabilitySLOBreach, ErrorBudgetBurning
- **Correlation**: UpstreamServiceImpact, DependencyChainFailure
- **Predictive**: MemoryLeakSuspected, DiskSpaceRunningOut

---

## 🎯 Quick Demo

### Step 1: Trigger an Alert
```bash
# Set high error rate
curl -X POST "http://localhost:8080/simulate-failure?mode=high_errors"

# Generate traffic
curl -X POST "http://localhost:8080/generate-traffic?requests=200"
```

### Step 2: Watch Real-Time Updates
Open browser console and connect to WebSocket:
```javascript
const ws = new WebSocket('ws://localhost:8005/ws');
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Step 3: View Incident in UI
Open http://localhost:5173/incidents

### Step 4: Check Audit Logs
```bash
curl "http://localhost:8008/audit-logs?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&limit=5"
```

### Step 5: Reset
```bash
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

---

## 🧪 Test the New Features

### Test WebSocket Health
```bash
curl http://localhost:8005/health
# {"status":"healthy","service":"websocket-service","connections":0}

curl http://localhost:8005/stats
# {"total_connections":0,"connections_by_tenant":{}}
```

### Test Audit Service
```bash
# Create a test audit log
curl -X POST http://localhost:8008/audit-logs \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "user_email": "test@example.com",
    "tenant_id": "e56947c7-554b-4ea8-9d88-97b16477b077",
    "action": "test.action",
    "resource_type": "test",
    "ip_address": "127.0.0.1",
    "user_agent": "curl",
    "success": true
  }'

# Retrieve it
curl "http://localhost:8008/audit-logs?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&limit=1"
```

### Test Advanced Alerts
```bash
# View all loaded alert rules
curl -s http://localhost:9090/api/v1/rules | python -m json.tool | grep -E '"alert"' | wc -l
# Should show 30+ alerts

# View active alerts
curl -s http://localhost:9090/api/v1/alerts | python -m json.tool
```

### Test Encryption
```bash
# Request encrypted response (when middleware is active)
curl -H "X-Encryption-Enabled: true" http://localhost:8000/health
```

---

## 📊 Monitoring Dashboard

### Prometheus Queries
```promql
# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# P95 Latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU Usage
app_cpu_usage_percent

# Memory Usage
app_memory_usage_percent
```

### Grafana
- **URL**: http://localhost:3000
- **Username**: admin
- **Password**: admin
- **Dashboard**: SRE Copilot - Dummy App

---

## 🧪 Run Tests

```bash
# All tests
pytest tests/ -v

# Unit tests only
pytest tests/unit/ -v

# Integration tests
pytest tests/integration/ -v -m integration

# With coverage
pytest tests/ -v --cov=services --cov-report=html
# Open: htmlcov/index.html
```

---

## 🔍 Debugging

### View Logs
```bash
# WebSocket service
docker logs sre-copilot-websocket-service --tail 50 -f

# Audit service
docker logs sre-copilot-audit-service --tail 50 -f

# AI service
docker logs sre-copilot-ai-service --tail 50 -f

# All services
docker-compose logs -f
```

### Check Service Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Restart Services
```bash
# Restart specific service
docker-compose restart websocket-service

# Restart all
docker-compose restart

# Full rebuild
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 🎨 Frontend Features

### Available Pages
- **Dashboard**: http://localhost:5173/
- **Incidents**: http://localhost:5173/incidents
- **Incident Detail**: http://localhost:5173/incidents/{id}
- **Login**: http://localhost:5173/login

### Default Credentials
- **Email**: test@example.com
- **Password**: password123

---

## 📚 Documentation

- **ENHANCEMENTS.md** - Complete enhancement plan (70+ pages)
- **TESTING.md** - Comprehensive testing guide
- **V2.0_RELEASE_NOTES.md** - Full release documentation
- **MODEL_UPDATE.md** - GPT-4 to GPT-4o-mini migration
- **INTEGRATION_COMPLETE.md** - Integration summary

---

## 🐛 Troubleshooting

### Services not responding?
```bash
# Check if containers are running
docker ps | grep sre-copilot

# Check logs for errors
docker-compose logs --tail 50

# Restart services
docker-compose restart
```

### Port conflicts?
```bash
# Check what's using ports
netstat -ano | findstr "8000 8001 8002 8003 8004 8005 8008 5173"

# Stop and restart
docker-compose down
docker-compose up -d
```

### Database issues?
```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres redis
sleep 10
docker-compose up -d
```

### Frontend not updating?
```bash
# Clear browser cache
# Ctrl + F5 (hard refresh)

# Or rebuild frontend
docker-compose build frontend --no-cache
docker-compose restart frontend
```

---

## 🎯 Next Steps

1. **Explore WebSocket**: Connect and see real-time updates
2. **Review Audit Logs**: Check what's being logged
3. **Test Encryption**: Try encrypted API responses
4. **Trigger Alerts**: Use dummy app to test alerting
5. **View Dashboards**: Check Grafana for metrics
6. **Run Tests**: Verify everything works
7. **Read Docs**: Deep dive into ENHANCEMENTS.md

---

## 💡 Tips

- **WebSocket**: Great for live dashboards
- **Audit Logs**: Essential for compliance and debugging
- **Encryption**: Enable for sensitive endpoints
- **Advanced Alerts**: Catches issues before they become critical
- **Tests**: Run before deploying changes

---

## 🚀 Production Checklist

Before deploying to production:

- [ ] Change default passwords (.env)
- [ ] Set strong ENCRYPTION_MASTER_KEY
- [ ] Configure proper JWT_SECRET_KEY
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall rules
- [ ] Set up backup for PostgreSQL
- [ ] Configure log retention policies
- [ ] Set up monitoring alerts notifications
- [ ] Run full test suite
- [ ] Load test critical endpoints
- [ ] Review security settings
- [ ] Set up CI/CD pipeline

---

**SRE Copilot v2.0 - Production Ready! 🎉**

For issues or questions, check:
- GitHub: https://github.com/raghavrallan/sre-copilot
- Docs: ENHANCEMENTS.md, TESTING.md
