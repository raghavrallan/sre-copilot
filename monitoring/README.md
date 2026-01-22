# SRE Copilot Monitoring Stack

Prometheus + Grafana + AlertManager monitoring stack for SRE Copilot development and demo.

## Components

- **Prometheus** (`:9090`) - Metrics collection and alerting engine
- **AlertManager** (`:9093`) - Alert handling and routing
- **Grafana** (`:3000`) - Dashboards and visualization
- **Dummy App** (`:8080`) - Sample application generating metrics

## Quick Start

### 1. Start SRE Copilot Services

First, make sure the main SRE Copilot services are running:

```bash
cd ..
docker-compose up -d
```

### 2. Start Monitoring Stack

```bash
cd monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Access Services

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **AlertManager**: http://localhost:9093
- **Dummy App**: http://localhost:8080

## Dummy App Endpoints

The dummy app exposes several endpoints for testing:

- `GET /` - Root endpoint
- `GET /api/users` - Users API
- `POST /api/orders` - Orders API
- `GET /health` - Health check
- `GET /metrics` - Prometheus metrics
- `POST /simulate-load?level=<normal|high|critical>` - Simulate load

### Simulate Load

To trigger alerts, simulate high load:

```bash
# Normal load (default)
curl -X POST http://localhost:8080/simulate-load?level=normal

# High load (triggers HighLatency alert)
curl -X POST http://localhost:8080/simulate-load?level=high

# Critical load (triggers HighLatency and HighErrorRate alerts)
curl -X POST http://localhost:8080/simulate-load?level=critical
```

## Alert Rules

The following alerts are configured in `prometheus/rules/alerts.yml`:

### Dummy App Alerts
- **HighErrorRate**: Error rate > 5% for 2 minutes
- **HighLatency**: P95 latency > 2s for 3 minutes
- **HighCPUUsage**: CPU usage > 80% for 5 minutes
- **HighMemoryUsage**: Memory usage > 85% for 5 minutes
- **ServiceDown**: Service unreachable for 1 minute
- **HighRequestRate**: Request rate > 100 req/s for 3 minutes

### SRE Copilot Alerts
- **DatabasePoolExhausted**: Connection pool > 90% full
- **RedisConnectionFailed**: Redis connection errors
- **AIServiceFailures**: AI hypothesis generation failures

## Viewing Alerts

### In Prometheus
1. Go to http://localhost:9090/alerts
2. See all active and pending alerts

### In AlertManager
1. Go to http://localhost:9093
2. See grouped and routed alerts
3. Alerts are automatically sent to SRE Copilot webhook

### In Grafana
1. Go to http://localhost:3000
2. Navigate to "Alerting" → "Alert rules"
3. View configured alert rules and their status

## Grafana Dashboards

Pre-configured dashboards:
- **Dummy App Metrics** - Request rate, latency, CPU, memory

To add more dashboards:
1. Create dashboard JSON in `grafana/dashboards/`
2. Restart Grafana: `docker-compose -f docker-compose.monitoring.yml restart grafana`

## Webhook Integration

AlertManager is configured to send alerts to:
```
http://integration-service:8004/webhooks/alertmanager
```

This creates incidents automatically in the SRE Copilot system.

## Stopping the Stack

```bash
docker-compose -f docker-compose.monitoring.yml down
```

To remove all data:
```bash
docker-compose -f docker-compose.monitoring.yml down -v
```

## Troubleshooting

### Prometheus can't scrape targets

Check if services are accessible:
```bash
docker network inspect monitoring
docker-compose -f docker-compose.monitoring.yml logs prometheus
```

### AlertManager not receiving alerts

Check Prometheus alert configuration:
```bash
docker-compose -f docker-compose.monitoring.yml logs alertmanager
curl http://localhost:9090/api/v1/rules
```

### Grafana dashboards not loading

Check provisioning:
```bash
docker-compose -f docker-compose.monitoring.yml logs grafana
```

## Next Steps

1. ✅ Start monitoring stack
2. ✅ Verify metrics collection in Prometheus
3. ✅ View dashboards in Grafana
4. ✅ Trigger test alerts
5. ⏭️ Integrate with SRE Copilot webhook receivers
6. ⏭️ Implement incident auto-creation from alerts
