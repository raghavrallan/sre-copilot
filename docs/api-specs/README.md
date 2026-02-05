# SRE Copilot - API Specifications

**Last Updated:** 2026-02-01
**Base URL:** `http://localhost:8580/api/v1`

---

## Overview

This document provides comprehensive API specifications for the SRE Copilot platform. All endpoints require authentication unless otherwise noted.

---

## Authentication

### Token Format
All authenticated requests use JWT tokens stored in httpOnly cookies or Bearer tokens in the Authorization header.

```
Authorization: Bearer <access_token>
```

Or automatically via httpOnly cookie (`access_token`).

### Token Expiry
- **Access Token:** 15 minutes
- **Refresh Token:** 7 days

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/auth/register` | Register new user and tenant | No |
| POST | `/auth/login` | Login and get tokens | No |
| POST | `/auth/logout` | Logout and clear cookies | Yes |
| POST | `/auth/refresh` | Refresh access token | Refresh Token |
| GET | `/auth/me` | Get current user info | Yes |
| POST | `/auth/switch-project` | Switch active project | Yes |
| GET | `/auth/ws-token` | Get WebSocket token | Yes |

### Projects

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/projects` | List user's projects | Yes |
| POST | `/projects` | Create new project | Yes |
| GET | `/projects/{id}` | Get project details | Yes |
| PATCH | `/projects/{id}` | Update project | Yes (Owner) |
| DELETE | `/projects/{id}` | Delete project | Yes (Owner) |
| GET | `/projects/{id}/members` | List project members | Yes |
| POST | `/projects/{id}/members` | Add project member | Yes (Admin) |
| PATCH | `/projects/{id}/members/{user_id}` | Update member role | Yes (Admin) |
| DELETE | `/projects/{id}/members/{user_id}` | Remove member | Yes (Admin) |

### Incidents

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/incidents` | List incidents | Yes |
| POST | `/incidents` | Create incident | Yes |
| GET | `/incidents/{id}` | Get incident details | Yes |
| PATCH | `/incidents/{id}/state` | Update incident state | Yes |
| GET | `/incidents/{id}/hypotheses` | Get AI hypotheses | Yes |
| GET | `/incidents/{id}/workflow` | Get workflow steps | Yes |
| GET | `/incidents/{id}/metrics` | Get incident metrics | Yes |

### Analytics

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/analytics/token-usage` | Get token usage stats | Yes |
| GET | `/analytics/cost-summary` | Get cost analytics | Yes |
| GET | `/analytics/incident-metrics/{id}` | Get per-incident analytics | Yes |

### Monitoring Integrations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/projects/{id}/monitoring/integrations` | List integrations | Yes |
| POST | `/projects/{id}/monitoring/integrations` | Create integration | Yes (Admin) |
| GET | `/projects/{id}/monitoring/integrations/{integration_id}` | Get integration | Yes |
| PATCH | `/projects/{id}/monitoring/integrations/{integration_id}` | Update integration | Yes (Admin) |
| DELETE | `/projects/{id}/monitoring/integrations/{integration_id}` | Delete integration | Yes (Admin) |
| POST | `/projects/{id}/monitoring/integrations/test-connection` | Test connection | Yes |
| POST | `/projects/{id}/monitoring/integrations/{integration_id}/test` | Test existing | Yes |
| GET | `/projects/{id}/monitoring/alerts` | List alerts | Yes |

---

## Detailed API Reference

### Authentication

#### POST /auth/register

Register a new user and create a tenant.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123",
  "full_name": "John Doe",
  "tenant_name": "Acme Corporation"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "full_name": "John Doe",
    "tenant_id": "660e8400-e29b-41d4-a716-446655440001"
  },
  "tenant": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "name": "Acme Corporation",
    "slug": "acme-corporation"
  },
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Cookies Set:**
- `access_token` (httpOnly, 15 min)
- `refresh_token` (httpOnly, 7 days)

---

#### POST /auth/login

Authenticate user and get tokens.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "full_name": "John Doe",
    "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
    "project_id": "770e8400-e29b-41d4-a716-446655440002",
    "role": "admin"
  },
  "projects": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "name": "Production",
      "role": "admin"
    }
  ],
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

**Error Responses:**
- `401 Unauthorized`: Invalid credentials
- `400 Bad Request`: Missing required fields

---

### Incidents

#### GET /incidents

List incidents for the current project.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| skip | integer | 0 | Pagination offset |
| limit | integer | 10 | Items per page (max 100) |
| severity | string | - | Filter by severity |
| state | string | - | Filter by state |

**Response (200):**
```json
[
  {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "title": "High error rate on payment-api",
    "description": "Error rate exceeded 5% threshold",
    "service_name": "payment-api",
    "severity": "critical",
    "state": "investigating",
    "detected_at": "2026-01-24T12:00:00Z",
    "acknowledged_at": "2026-01-24T12:02:00Z",
    "project_id": "770e8400-e29b-41d4-a716-446655440002",
    "created_at": "2026-01-24T12:00:00Z",
    "updated_at": "2026-01-24T12:02:00Z"
  }
]
```

---

#### POST /incidents

Create a new incident.

**Request:**
```json
{
  "title": "High CPU usage on payment-api",
  "description": "CPU spiked to 90% after recent deployment",
  "service_name": "payment-api",
  "severity": "high"
}
```

**Response (200):**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "title": "High CPU usage on payment-api",
  "description": "CPU spiked to 90% after recent deployment",
  "service_name": "payment-api",
  "severity": "high",
  "state": "detected",
  "detected_at": "2026-01-24T12:00:00Z",
  "project_id": "770e8400-e29b-41d4-a716-446655440002",
  "created_at": "2026-01-24T12:00:00Z"
}
```

**Severity Values:**
- `critical` - Immediate attention required
- `high` - Urgent, significant impact
- `medium` - Moderate impact
- `low` - Minor impact
- `info` - Informational

---

#### GET /incidents/{id}/hypotheses

Get AI-generated hypotheses for an incident.

**Response (200):**
```json
[
  {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "incident_id": "880e8400-e29b-41d4-a716-446655440003",
    "claim": "Recent deployment caused downstream timeout",
    "description": "The deployment of v2.4.5 introduced a bug that causes timeout errors when connecting to Redis...",
    "confidence_score": 0.85,
    "confidence_lower": 0.72,
    "confidence_upper": 0.92,
    "rank": 1,
    "supporting_evidence": [
      "Deployment v2.4.5 completed 10 minutes before symptoms",
      "Redis response time increased +40%",
      "Similar incident on 2025-12-03 (INC-445)"
    ],
    "contradicting_evidence": [
      "No error logs in payment-api (unexpected)"
    ],
    "user_feedback": null,
    "created_at": "2026-01-24T12:01:00Z"
  }
]
```

---

#### PATCH /incidents/{id}/state

Update incident state.

**Request:**
```json
{
  "state": "investigating"
}
```

**Response (200):**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "state": "investigating",
  "investigating_started_at": "2026-01-24T12:05:00Z"
}
```

**State Values:**
- `detected` - Initial state
- `acknowledged` - Acknowledged by responder
- `investigating` - Under investigation
- `mitigated` - Impact mitigated
- `resolved` - Fully resolved
- `learned` - Post-mortem completed
- `inconclusive` - Cannot determine root cause

---

### Analytics

#### GET /analytics/token-usage

Get AI token usage statistics.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| start_date | date | 7 days ago | Start of period |
| end_date | date | today | End of period |

**Response (200):**
```json
{
  "total_requests": 150,
  "total_tokens": 125000,
  "total_cost_usd": 0.125,
  "breakdown_by_type": [
    {
      "request_type": "hypothesis",
      "count": 150,
      "total_tokens": 125000,
      "cost_usd": 0.125
    }
  ],
  "timeline": [
    {
      "date": "2026-01-24",
      "requests": 50,
      "tokens": 42000,
      "cost_usd": 0.042
    }
  ]
}
```

---

#### GET /analytics/cost-summary

Get cost summary with optimization recommendations.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| days | integer | 7 | Number of days |

**Response (200):**
```json
{
  "overall_stats": {
    "total_requests": 150,
    "total_cost_usd": 0.125,
    "avg_cost_per_request": 0.00083
  },
  "cache_stats": {
    "total_incidents": 200,
    "incidents_with_hypotheses": 150,
    "cache_hit_rate": 75.0,
    "potential_savings": 0.094
  },
  "most_expensive_incidents": [
    {
      "incident_id": "880e8400-e29b-41d4-a716-446655440003",
      "title": "High CPU usage",
      "total_cost": 0.015,
      "request_count": 3
    }
  ],
  "recommendations": [
    {
      "type": "low_cache_hit_rate",
      "message": "Cache hit rate (75%) could be improved...",
      "priority": "medium"
    }
  ]
}
```

---

## WebSocket API

### Connection

Connect to WebSocket for real-time updates.

**URL:** `ws://localhost:8505/ws`

### Authentication

Send authentication message after connecting:

```json
{
  "type": "connect",
  "token": "eyJ...",
  "tenantId": "660e8400-e29b-41d4-a716-446655440001"
}
```

### Subscribe to Channels

```json
{
  "type": "subscribe",
  "channels": ["incidents", "hypotheses", "alerts"]
}
```

### Event Types

#### incident.created

```json
{
  "type": "incident.created",
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "title": "High error rate on api-gateway",
    "severity": "critical",
    "state": "detected"
  },
  "timestamp": "2026-01-24T12:00:00Z"
}
```

#### incident.updated

```json
{
  "type": "incident.updated",
  "data": {
    "id": "880e8400-e29b-41d4-a716-446655440003",
    "state": "investigating"
  },
  "timestamp": "2026-01-24T12:05:00Z"
}
```

#### hypothesis.generated

```json
{
  "type": "hypothesis.generated",
  "incidentId": "880e8400-e29b-41d4-a716-446655440003",
  "data": {
    "count": 3,
    "top_hypothesis": {
      "claim": "Recent deployment issue",
      "confidence_score": 0.85
    }
  },
  "timestamp": "2026-01-24T12:01:00Z"
}
```

#### alert.fired

```json
{
  "type": "alert.fired",
  "data": {
    "alertname": "HighErrorRate",
    "severity": "critical",
    "service": "api-gateway",
    "description": "Error rate > 5%"
  },
  "timestamp": "2026-01-24T12:00:00Z"
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 409 | Conflict - Resource already exists |
| 422 | Unprocessable Entity - Validation error |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

### Rate Limiting Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 42
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `skip` - Number of items to skip (default: 0)
- `limit` - Number of items to return (default: 10, max: 100)

**Example:**
```
GET /incidents?skip=20&limit=10
```

---

## Interactive API Documentation

Access interactive API documentation:

- **Swagger UI:** http://localhost:8580/docs
- **ReDoc:** http://localhost:8580/redoc

Each microservice also has its own documentation:
- Auth Service: http://localhost:8501/docs
- Incident Service: http://localhost:8502/docs
- AI Service: http://localhost:8503/docs
- Integration Service: http://localhost:8504/docs

---

## Related Documentation

- [System Architecture](../architecture/system-architecture.md)
- [Data Models](../data-models/core-models.md)
- [Security](./security.md)
