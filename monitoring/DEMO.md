# SRE Copilot - Complete Demo Guide

This guide demonstrates the end-to-end flow: Dummy App Failures → Prometheus Alerts → AlertManager → SRE Copilot → AI Hypotheses

## Quick Start

### 1. Ensure All Services Are Running

```bash
# Start main SRE Copilot services
cd ..
docker-compose up -d

# Start monitoring stack
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 2. Verify Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **AlertManager**: http://localhost:9093
- **Dummy App**: http://localhost:8080
- **SRE Copilot UI**: http://localhost:5173

## Demo Scenarios

### Scenario 1: High Error Rate (Triggers HighErrorRate Alert)

```bash
# 1. Set failure mode to high_errors (15% error rate)
curl -X POST "http://localhost:8080/simulate-failure?mode=high_errors"

# 2. Generate traffic to trigger the alert
curl -X POST "http://localhost:8080/generate-traffic?requests=200"

# 3. Wait 2-3 minutes for alert to fire

# 4. Check Prometheus alerts
curl -s http://localhost:9090/api/v1/alerts | grep -A 5 "HighErrorRate"

# 5. Check AlertManager
curl -s http://localhost:9093/api/v2/alerts | grep -A 10 "HighErrorRate"

# 6. View incident in SRE Copilot UI
# Go to http://localhost:5173/incidents
# You should see a new incident: "[CRITICAL] HighErrorRate on dummy-app"

# 7. Reset to normal
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

**Expected Result:**
- Alert fires in Prometheus after 2 minutes
- AlertManager sends webhook to integration-service
- New incident created automatically in SRE Copilot
- AI generates 3-5 hypotheses for the incident

### Scenario 2: High Latency (Triggers HighLatency Alert)

```bash
# 1. Set high latency mode (5x normal latency)
curl -X POST "http://localhost:8080/simulate-failure?mode=high_latency"

# 2. Generate traffic
curl -X POST "http://localhost:8080/generate-traffic?requests=150"

# 3. Keep generating traffic for 3+ minutes
for i in {1..10}; do
    curl -X POST "http://localhost:8080/generate-traffic?requests=50"
    sleep 20
done

# 4. Check alerts in Prometheus
# Go to http://localhost:9090/alerts

# 5. View incident in UI
# http://localhost:5173/incidents

# 6. Reset
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

**Expected Result:**
- P95 latency exceeds 2 seconds
- HighLatency alert fires after 3 minutes
- Incident created: "[WARNING] HighLatency on dummy-app"

### Scenario 3: Database Failure (Multiple Alerts)

```bash
# 1. Simulate database connection pool exhaustion
curl -X POST "http://localhost:8080/simulate-failure?mode=database_failure"

# 2. Generate heavy traffic
curl -X POST "http://localhost:8080/generate-traffic?requests=300"

# 3. Continue generating load
for i in {1..5}; do
    curl -X POST "http://localhost:8080/generate-traffic?requests=100"
    sleep 30
done

# 4. Check multiple alerts should fire:
#    - HighErrorRate (40% errors)
#    - database_connection_errors_total metric increases

# 5. Reset
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

### Scenario 4: Critical Multi-Failure

```bash
# 1. Trigger critical mode (everything fails at once)
curl -X POST "http://localhost:8080/simulate-failure?mode=critical"

# 2. Generate traffic
curl -X POST "http://localhost:8080/generate-traffic?requests=200"

# 3. Check system metrics
curl -s http://localhost:8080/metrics | grep -E "app_cpu_usage|app_memory_usage"

# 4. Multiple alerts should fire:
#    - HighErrorRate
#    - HighLatency
#    - HighCPUUsage
#    - HighMemoryUsage

# 5. View all incidents in UI
# http://localhost:5173/incidents

# 6. Reset
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

### Scenario 5: CPU Spike

```bash
# Simulate CPU spike
curl -X POST "http://localhost:8080/simulate-failure?mode=cpu_spike"

# Wait 5 minutes for HighCPUUsage alert to fire

# Check metrics
curl -s http://localhost:8080/metrics | grep "app_cpu_usage_percent"

# Reset
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

### Scenario 6: Memory Leak

```bash
# Simulate memory leak
curl -X POST "http://localhost:8080/simulate-failure?mode=memory_leak"

# Watch memory grow over time
curl -s http://localhost:8080/failure-status

# Wait 5 minutes for HighMemoryUsage alert

# Reset
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
```

## Failure Modes Reference

| Mode | Error Rate | Latency | CPU | Memory | Description |
|------|-----------|---------|-----|--------|-------------|
| `normal` | 2% | 1x | Normal | Normal | Healthy state |
| `high_errors` | 15% | 1.5x | Normal | Normal | Triggers HighErrorRate |
| `high_latency` | 3% | 5x | Normal | Normal | Triggers HighLatency |
| `cpu_spike` | 5% | 2x | 80-95% | Normal | Triggers HighCPUUsage |
| `memory_leak` | 3% | 1.5x | Normal | Growing | Triggers HighMemoryUsage |
| `database_failure` | 40% | 3x | Normal | Normal | Database connection errors |
| `critical` | 30% | 8x | 80-95% | Growing | Multiple simultaneous failures |

## Monitoring & Verification

### Check Prometheus Metrics

```bash
# View all metrics from dummy app
curl -s http://localhost:8080/metrics

# Query Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=http_requests_total' | python -m json.tool
```

### Check Active Alerts

```bash
# Prometheus alerts
curl -s http://localhost:9090/api/v1/alerts | python -m json.tool | head -50

# AlertManager alerts
curl -s http://localhost:9093/api/v2/alerts | python -m json.tool | head -50
```

### Check Incidents Created

```bash
# List all incidents (requires authentication)
# Login first at http://localhost:5173/login

# Or check directly via incident service
docker exec -it sre-copilot-incident-service curl "http://localhost:8002/incidents?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077&limit=10"
```

### Check Hypotheses Generated

```bash
# Get hypotheses for an incident (replace INCIDENT_ID)
docker exec -it sre-copilot-incident-service curl "http://localhost:8002/incidents/INCIDENT_ID/hypotheses?tenant_id=e56947c7-554b-4ea8-9d88-97b16477b077"
```

## Tips & Troubleshooting

1. **Alerts not firing?**
   - Check alert thresholds in `prometheus/rules/alerts.yml`
   - Ensure you're generating enough traffic
   - Wait for the alert evaluation period (`for: 2m` means 2 minutes)

2. **Incidents not appearing?**
   - Check integration-service logs: `docker logs sre-copilot-integration-service --tail 50`
   - Verify AlertManager webhook is configured correctly
   - Check network connectivity between containers

3. **AI hypotheses not generating?**
   - Check AI service logs: `docker logs sre-copilot-ai-service --tail 50`
   - Verify Azure OpenAI credentials in `.env`
   - Check if using mock mode (will still generate dummy hypotheses)

4. **Reset everything:**
   ```bash
   curl -X POST "http://localhost:8080/simulate-failure?mode=normal"
   ```

## Full End-to-End Demo

```bash
#!/bin/bash
# Complete demo script

echo "🚀 Starting SRE Copilot Demo..."

echo "1️⃣  Setting failure mode to high_errors..."
curl -X POST "http://localhost:8080/simulate-failure?mode=high_errors"

echo "2️⃣  Generating traffic..."
curl -X POST "http://localhost:8080/generate-traffic?requests=200"

echo "3️⃣  Waiting 150 seconds for alert to fire..."
sleep 150

echo "4️⃣  Checking Prometheus alerts..."
curl -s http://localhost:9090/api/v1/alerts | python -m json.tool | grep -A 3 "HighErrorRate"

echo "5️⃣  Checking AlertManager..."
curl -s http://localhost:9093/api/v2/alerts | python -m json.tool | head -30

echo "6️⃣  Checking incidents (open http://localhost:5173/incidents in browser)"

echo "7️⃣  Resetting to normal..."
curl -X POST "http://localhost:8080/simulate-failure?mode=normal"

echo "✅ Demo complete! Check the UI at http://localhost:5173"
```

Save this as `demo.sh` and run with `bash demo.sh`
