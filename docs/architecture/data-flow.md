# SRE Copilot - Data Flow Architecture

**Last Updated:** 2026-02-01

---

## Overview

This document describes the data flow patterns in the SRE Copilot platform, from signal ingestion to incident resolution.

---

## High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SIGNAL SOURCES                                  │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│  │ Prometheus  │  │ AlertManager│  │   Grafana   │  │ Manual/UI   │       │
│  │  (Metrics)  │  │  (Alerts)   │  │ (Dashboards)│  │  (Incidents)│       │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │
└─────────┼────────────────┼────────────────┼────────────────┼───────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          INGESTION LAYER                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Integration Service (:8504)                     │    │
│  │                                                                    │    │
│  │  • Webhook Receivers (AlertManager, Prometheus, Grafana)          │    │
│  │  • Alert Normalization                                            │    │
│  │  • Severity Mapping                                               │    │
│  │  • Duplicate Detection                                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PROCESSING LAYER                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                    Incident Service (:8502)                        │    │
│  │                                                                    │    │
│  │  • Incident Creation/Management                                   │    │
│  │  • State Machine Transitions                                      │    │
│  │  • Workflow Tracking (AnalysisStep)                               │    │
│  │  • Real-time Publishing (Redis Pub/Sub)                           │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      AI Service (:8503)                            │    │
│  │                                                                    │    │
│  │  • Hypothesis Generation (Azure OpenAI GPT-4o-mini)               │    │
│  │  • Confidence Scoring                                             │    │
│  │  • Evidence Aggregation                                           │    │
│  │  • Token/Cost Tracking                                            │    │
│  │  • Caching Layer                                                  │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                          │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐         │
│  │   PostgreSQL     │  │      Redis       │  │   Prometheus     │         │
│  │                  │  │                  │  │                  │         │
│  │  • Incidents     │  │  • Cache         │  │  • Metrics       │         │
│  │  • Hypotheses    │  │  • Pub/Sub       │  │  • Baselines     │         │
│  │  • Users         │  │  • Locks         │  │  • Time-series   │         │
│  │  • Projects      │  │  • Sessions      │  │                  │         │
│  │  • AI Requests   │  │                  │  │                  │         │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                                     │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                                │
│  │ WebSocket Service│  │  API Gateway     │                                │
│  │     (:8505)      │  │    (:8500)       │                                │
│  │                  │  │                  │                                │
│  │  • Real-time     │  │  • REST API      │                                │
│  │  • Live Updates  │  │  • Auth Proxy    │                                │
│  │  • Notifications │  │  • Rate Limiting │                                │
│  └──────────────────┘  └──────────────────┘                                │
│                                   │                                          │
│                                   ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                      Frontend (:5173)                              │    │
│  │                                                                    │    │
│  │  • React + TypeScript                                             │    │
│  │  • Real-time Dashboard                                            │    │
│  │  • Incident Management UI                                         │    │
│  │  • Analytics Dashboard                                            │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Flow: Alert to Incident

### 1. Alert Detection

```
Prometheus Monitoring
        │
        ▼
┌─────────────────┐
│ Rule Evaluation │ Every 15s, evaluates alert rules
└────────┬────────┘
         │ Alert triggers (e.g., HighErrorRate > 5%)
         ▼
┌─────────────────┐
│  AlertManager   │ Groups, deduplicates, routes alerts
└────────┬────────┘
         │ Sends webhook
         ▼
POST /webhooks/alertmanager
```

### 2. Webhook Processing

```python
# Integration Service receives webhook
@router.post("/webhooks/alertmanager")
async def alertmanager_webhook(webhook: AlertManagerWebhook):
    for alert in webhook.alerts:
        # 1. Normalize alert data
        normalized = normalize_alert(alert)
        
        # 2. Map severity
        severity = map_severity(alert.labels.get("severity"))
        
        # 3. Check for duplicates
        if not is_duplicate(alert.fingerprint):
            # 4. Create incident
            incident = await create_incident(normalized, severity)
```

### 3. Incident Creation

```python
# Incident Service creates incident
async def create_incident(data, severity):
    # 1. Save to PostgreSQL
    incident = await Incident.objects.acreate(
        project_id=data.project_id,
        title=data.title,
        description=data.description,
        severity=severity,
        state=IncidentState.DETECTED
    )
    
    # 2. Create workflow step
    await AnalysisStep.objects.acreate(
        incident=incident,
        step_type="alert_received",
        status="completed"
    )
    
    # 3. Publish to Redis for real-time updates
    await redis.publish("incidents", {
        "type": "incident.created",
        "data": incident.to_dict()
    })
    
    # 4. Trigger AI hypothesis generation
    await trigger_hypothesis_generation(incident.id)
```

### 4. AI Hypothesis Generation

```python
# AI Service generates hypotheses
async def generate_hypotheses(incident_id):
    # 1. Check cache first
    existing = await Hypothesis.objects.filter(incident_id=incident_id).acount()
    if existing > 0:
        return cached_hypotheses  # No AI call needed
    
    # 2. Acquire Redis lock (prevent duplicates)
    lock_key = f"ai:generating:{incident_id}"
    if redis.exists(lock_key):
        raise HTTPException(409, "Already generating")
    redis.setex(lock_key, 60, "1")
    
    # 3. Build context
    context = {
        "incident": incident.to_dict(),
        "service": incident.service_name,
        "severity": incident.severity
    }
    
    # 4. Call Azure OpenAI
    response = await openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": format_prompt(context)}
        ],
        max_tokens=800
    )
    
    # 5. Parse and save hypotheses
    hypotheses = parse_response(response)
    for h in hypotheses:
        await Hypothesis.objects.acreate(
            incident_id=incident_id,
            claim=h.claim,
            description=h.description,
            confidence_score=h.confidence
        )
    
    # 6. Track AI request for cost analytics
    await AIRequest.objects.acreate(
        incident_id=incident_id,
        input_tokens=response.usage.prompt_tokens,
        output_tokens=response.usage.completion_tokens,
        cost_usd=calculate_cost(response.usage)
    )
    
    # 7. Publish to Redis
    await redis.publish("hypotheses", {
        "type": "hypothesis.generated",
        "incident_id": incident_id,
        "count": len(hypotheses)
    })
```

### 5. Real-Time Updates

```python
# WebSocket Service broadcasts updates
async def redis_subscriber():
    pubsub = redis.pubsub()
    await pubsub.subscribe("incidents", "hypotheses", "alerts")
    
    async for message in pubsub.listen():
        # Broadcast to connected clients
        data = json.loads(message["data"])
        
        # Only send to clients subscribed to this tenant
        for connection in connections[data["tenant_id"]]:
            await connection.send_json(data)
```

### 6. Frontend Updates

```typescript
// React component receives updates
const { incidents } = useRealTimeIncidents();

useEffect(() => {
    const ws = new WebSocket('ws://localhost:8505/ws');
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (message.type === 'incident.created') {
            setIncidents(prev => [message.data, ...prev]);
            toast.success('New incident detected!');
        }
        
        if (message.type === 'hypothesis.generated') {
            // Refresh hypotheses for this incident
            fetchHypotheses(message.incident_id);
            toast.info('AI hypotheses generated');
        }
    };
}, []);
```

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────▶│ API Gateway │────▶│Auth Service │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │  1. POST /login   │                   │
       │  {email, pass}    │                   │
       │──────────────────▶│                   │
       │                   │  2. Forward       │
       │                   │──────────────────▶│
       │                   │                   │  3. Validate
       │                   │                   │  credentials
       │                   │  4. Return tokens │
       │                   │◀──────────────────│
       │                   │                   │
       │  5. Set cookies   │                   │
       │◀──────────────────│                   │
       │  (httpOnly)       │                   │
       │                   │                   │
       │  6. GET /incidents│                   │
       │  (with cookies)   │                   │
       │──────────────────▶│                   │
       │                   │  7. Verify token  │
       │                   │──────────────────▶│
       │                   │◀──────────────────│
       │                   │                   │
       │  8. Proxy to      │                   │
       │  Incident Service │                   │
       │◀──────────────────│                   │
```

### Token Structure

```json
{
  "user_id": "uuid",
  "tenant_id": "uuid",
  "project_id": "uuid",
  "email": "user@example.com",
  "role": "engineer",
  "exp": 1706745600,
  "type": "access"
}
```

---

## Caching Strategy

### AI Response Caching

```
Request for hypotheses
        │
        ▼
┌─────────────────┐
│ Check Database  │
│ (Hypothesis     │
│  table)         │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Exists? │
    └────┬────┘
         │
    ┌────┴────┐
    │         │
    ▼ Yes     ▼ No
┌────────┐  ┌────────────┐
│ Return │  │ Check Redis│
│ Cached │  │   Lock     │
└────────┘  └─────┬──────┘
                  │
             ┌────┴────┐
             │ Locked? │
             └────┬────┘
                  │
        ┌─────────┴─────────┐
        │ Yes               │ No
        ▼                   ▼
    ┌────────┐        ┌────────────┐
    │ Wait & │        │ Acquire    │
    │ Retry  │        │ Lock       │
    └────────┘        └─────┬──────┘
                            │
                            ▼
                      ┌────────────┐
                      │ Call AI    │
                      │ Service    │
                      └─────┬──────┘
                            │
                            ▼
                      ┌────────────┐
                      │ Save to DB │
                      │ & Return   │
                      └────────────┘
```

---

## Event Publishing

### Redis Channels

| Channel | Events | Publishers |
|---------|--------|------------|
| `incidents` | `incident.created`, `incident.updated` | Incident Service |
| `hypotheses` | `hypothesis.generated` | AI Service |
| `alerts` | `alert.fired`, `alert.resolved` | Integration Service |

### Event Format

```json
{
  "type": "incident.created",
  "tenant_id": "uuid",
  "project_id": "uuid",
  "data": {
    "id": "uuid",
    "title": "High error rate on api-gateway",
    "severity": "critical",
    "state": "detected"
  },
  "timestamp": "2026-01-24T12:00:00Z"
}
```

---

## Database Relationships

```
┌─────────────┐
│   Tenant    │
└──────┬──────┘
       │ 1:N
       ▼
┌─────────────┐
│   Project   │
└──────┬──────┘
       │ 1:N
       ├────────────────────┬────────────────────┐
       ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  Incident   │      │   User      │      │ Integration │
└──────┬──────┘      │ (via member)│      └─────────────┘
       │             └─────────────┘
       │ 1:N
       ├────────────────────┬────────────────────┐
       ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│ Hypothesis  │      │ AIRequest   │      │AnalysisStep │
└─────────────┘      └─────────────┘      └─────────────┘
```

---

## Error Handling Flow

```
Request
    │
    ▼
┌─────────────────┐
│  API Gateway    │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Success │───Yes──▶ Return response
    └────┬────┘
         │ No
         ▼
┌─────────────────┐
│ Error Type?     │
└────────┬────────┘
         │
    ┌────┴────────────────────────┐
    │                             │
    ▼ 4xx                         ▼ 5xx
┌──────────────┐           ┌──────────────┐
│ Client Error │           │ Server Error │
│ - Return as  │           │ - Log error  │
│   is         │           │ - Return 500 │
└──────────────┘           │ - Alert if   │
                           │   critical   │
                           └──────────────┘
```

---

## Related Documentation

- [System Architecture](./system-architecture.md)
- [API Specifications](../api-specs/README.md)
- [Data Models](../data-models/core-models.md)
