# SRE Copilot - Webhook API Specifications

**Last Updated:** 2026-02-01

---

## Overview

SRE Copilot supports incoming webhooks from various monitoring tools to automatically create incidents and trigger AI analysis.

---

## Supported Integrations

| Integration | Endpoint | Status |
|-------------|----------|--------|
| AlertManager | `/webhooks/alertmanager` | Active |
| Prometheus | `/webhooks/prometheus/{integration_id}` | Active |
| Grafana | `/webhooks/grafana/{integration_id}` | Active |

---

## AlertManager Webhook

### Endpoint

```
POST http://localhost:8504/webhooks/alertmanager
```

### Payload Format

AlertManager sends alerts in the following format:

```json
{
  "version": "4",
  "groupKey": "{}:{alertname=\"HighErrorRate\"}",
  "truncatedAlerts": 0,
  "status": "firing",
  "receiver": "sre-copilot",
  "groupLabels": {
    "alertname": "HighErrorRate"
  },
  "commonLabels": {
    "alertname": "HighErrorRate",
    "severity": "critical",
    "service": "api-gateway",
    "job": "dummy-app"
  },
  "commonAnnotations": {
    "summary": "High error rate detected",
    "description": "Error rate is above 5% for the api-gateway service"
  },
  "externalURL": "http://alertmanager:9093",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighErrorRate",
        "severity": "critical",
        "service": "api-gateway",
        "job": "dummy-app",
        "instance": "dummy-app:8080"
      },
      "annotations": {
        "summary": "High error rate detected",
        "description": "Error rate is above 5% for the api-gateway service"
      },
      "startsAt": "2026-01-24T12:00:00.000Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://prometheus:9090/graph?g0.expr=...",
      "fingerprint": "abc123def456"
    }
  ]
}
```

### Field Mapping

| AlertManager Field | SRE Copilot Field |
|-------------------|-------------------|
| `alerts[].labels.alertname` | `incident.title` |
| `alerts[].annotations.description` | `incident.description` |
| `alerts[].labels.service` | `incident.service_name` |
| `alerts[].labels.severity` | `incident.severity` |
| `alerts[].startsAt` | `incident.detected_at` |
| `alerts[].fingerprint` | Deduplication key |

### Severity Mapping

| AlertManager Severity | SRE Copilot Severity |
|----------------------|---------------------|
| `critical` | `critical` |
| `warning` | `high` |
| `info` | `medium` |
| (default) | `medium` |

### Response

**Success (200):**
```json
{
  "status": "success",
  "incidents_created": 1,
  "incidents": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440003",
      "title": "HighErrorRate",
      "fingerprint": "abc123def456"
    }
  ]
}
```

**Duplicate Alert (200):**
```json
{
  "status": "duplicate",
  "message": "Alert already processed",
  "fingerprint": "abc123def456"
}
```

---

## AlertManager Configuration

### Configure AlertManager to send alerts:

**alertmanager.yml:**
```yaml
route:
  group_by: ['alertname', 'service']
  group_wait: 30s
  group_interval: 5m
  repeat_interval: 4h
  receiver: 'default-receiver'
  routes:
    - match:
        severity: critical
      receiver: 'sre-copilot-webhook'
      continue: true
    - match:
        severity: warning
      receiver: 'sre-copilot-webhook'
      continue: true

receivers:
  - name: 'default-receiver'
    # Default receiver (e.g., PagerDuty, email)

  - name: 'sre-copilot-webhook'
    webhook_configs:
      - url: 'http://integration-service:8504/webhooks/alertmanager'
        send_resolved: true
        http_config:
          # Optional: Add authentication
          # authorization:
          #   type: Bearer
          #   credentials: '<webhook-secret>'
```

---

## Project-Specific Webhooks

For multi-project setups, use project-specific webhook endpoints.

### Endpoint

```
POST http://localhost:8504/webhooks/{integration_type}/{integration_id}
```

### Authentication

Include webhook secret in header:

```
X-Webhook-Secret: <webhook-secret-from-integration>
```

### Example Configuration

**alertmanager.yml (project-specific):**
```yaml
receivers:
  - name: 'project-production'
    webhook_configs:
      - url: 'http://integration-service:8504/webhooks/prometheus/550e8400-e29b-41d4-a716-446655440000'
        http_config:
          authorization:
            type: Bearer
            credentials: 'webhook-secret-for-this-integration'
```

---

## Grafana Webhook

### Endpoint

```
POST http://localhost:8504/webhooks/grafana/{integration_id}
```

### Payload Format

Grafana unified alerting sends:

```json
{
  "receiver": "sre-copilot",
  "status": "firing",
  "alerts": [
    {
      "status": "firing",
      "labels": {
        "alertname": "HighLatency",
        "grafana_folder": "Production Alerts",
        "service": "api-gateway"
      },
      "annotations": {
        "summary": "High latency detected",
        "description": "P99 latency > 1s for api-gateway"
      },
      "startsAt": "2026-01-24T12:00:00.000Z",
      "endsAt": "0001-01-01T00:00:00Z",
      "generatorURL": "http://grafana:3000/alerting/...",
      "fingerprint": "ghi789jkl012",
      "dashboardURL": "http://grafana:3000/d/abc123",
      "panelURL": "http://grafana:3000/d/abc123?viewPanel=1"
    }
  ],
  "groupLabels": {
    "alertname": "HighLatency"
  },
  "commonLabels": {
    "alertname": "HighLatency"
  },
  "commonAnnotations": {
    "summary": "High latency detected"
  },
  "externalURL": "http://grafana:3000",
  "version": "1",
  "groupKey": "HighLatency",
  "truncatedAlerts": 0,
  "orgId": 1,
  "title": "[FIRING:1] HighLatency",
  "state": "alerting",
  "message": "High latency detected"
}
```

### Grafana Configuration

**Contact Point Configuration:**

1. Go to Alerting > Contact points
2. Add new contact point
3. Select "Webhook" integration
4. Configure:
   - URL: `http://integration-service:8504/webhooks/grafana/{integration_id}`
   - HTTP Method: POST
   - Authorization Header: `Bearer <webhook-secret>`

---

## Webhook Security

### Best Practices

1. **Use HTTPS in production** - Always use encrypted connections
2. **Webhook secrets** - Generate unique secrets per integration
3. **IP allowlisting** - Restrict webhook sources to known IPs
4. **Rate limiting** - Webhooks are rate-limited to prevent abuse

### Generating Webhook Secrets

```bash
# Generate secure webhook secret
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### Verifying Webhook Signatures

The Integration Service verifies webhook authenticity:

```python
# Verify webhook secret
webhook_secret = request.headers.get('X-Webhook-Secret')
if webhook_secret != integration.webhook_secret:
    raise HTTPException(403, "Invalid webhook secret")
```

---

## Error Handling

### Invalid Payload (400)

```json
{
  "detail": "Invalid webhook payload: missing required field 'alerts'"
}
```

### Invalid Authentication (403)

```json
{
  "detail": "Invalid webhook secret"
}
```

### Integration Not Found (404)

```json
{
  "detail": "Integration not found: 550e8400-e29b-41d4-a716-446655440000"
}
```

### Rate Limited (429)

```json
{
  "detail": "Too many webhook requests. Please retry after 60 seconds."
}
```

---

## Testing Webhooks

### Test with curl

```bash
# Test AlertManager webhook
curl -X POST http://localhost:8504/webhooks/alertmanager \
  -H "Content-Type: application/json" \
  -d '{
    "version": "4",
    "status": "firing",
    "alerts": [
      {
        "status": "firing",
        "labels": {
          "alertname": "TestAlert",
          "severity": "warning",
          "service": "test-service"
        },
        "annotations": {
          "summary": "Test alert",
          "description": "This is a test alert"
        },
        "startsAt": "2026-01-24T12:00:00.000Z",
        "fingerprint": "test123"
      }
    ]
  }'
```

### Test Project-Specific Webhook

```bash
curl -X POST "http://localhost:8504/webhooks/prometheus/{integration_id}" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-webhook-secret" \
  -d '{...}'
```

---

## Monitoring Webhook Health

### Check Integration Service Health

```bash
curl http://localhost:8504/health
```

### View Recent Webhook Activity

```bash
# Check integration service logs
docker logs sre-copilot-integration-service --tail 50
```

---

## Related Documentation

- [API Specifications](./README.md)
- [Monitoring Integrations](../guides/monitoring-setup.md)
- [System Architecture](../architecture/system-architecture.md)
