# SRE Copilot - Security Guide

**Last Updated:** 2026-02-01

---

## Overview

This document outlines the security features and best practices implemented in the SRE Copilot platform.

---

## Authentication

### JWT-Based Authentication

SRE Copilot uses JWT (JSON Web Tokens) for authentication with the following features:

| Feature | Implementation |
|---------|----------------|
| Algorithm | HS256 |
| Access Token Expiry | 15 minutes |
| Refresh Token Expiry | 7 days |
| Token Storage | httpOnly cookies |
| Password Hashing | bcrypt |

### Token Flow

```
1. User logs in → Auth Service validates credentials
2. Auth Service generates:
   - Access token (15 min, in httpOnly cookie)
   - Refresh token (7 days, in httpOnly cookie)
3. Each API request includes cookies automatically
4. API Gateway verifies token with Auth Service
5. Token expiry → Frontend calls /auth/refresh
6. New access token issued (if refresh token valid)
```

### httpOnly Cookies

**Why httpOnly?**
- Tokens are NOT accessible via JavaScript
- Protects against XSS (Cross-Site Scripting) attacks
- Browser handles cookie sending automatically

**Cookie Configuration:**
```python
response.set_cookie(
    key="access_token",
    value=access_token,
    httponly=True,
    secure=True,  # HTTPS only in production
    samesite="lax",
    max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
)
```

---

## End-to-End Encryption

### AES-256-GCM Encryption

SRE Copilot supports optional E2E encryption for API responses.

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key Size | 256 bits (32 bytes) |
| IV Size | 96 bits (12 bytes) |
| Key Derivation | PBKDF2-SHA256 (100,000 iterations) |
| Session Key TTL | 24 hours |

### Enabling Encryption

Add header to requests:
```
X-Encryption-Enabled: true
```

**Encrypted Response Format:**
```json
{
  "encrypted": true,
  "algorithm": "AES-256-GCM",
  "key_id": "session-key-identifier",
  "iv": "base64-encoded-iv",
  "data": "base64-encoded-encrypted-payload",
  "timestamp": "2026-01-24T12:00:00Z"
}
```

---

## Authorization

### Role-Based Access Control (RBAC)

SRE Copilot implements project-level RBAC:

| Role | Permissions |
|------|-------------|
| **Owner** | Full access, can delete project, manage members |
| **Admin** | Manage integrations, members (except owner) |
| **Engineer** | Create/update incidents, provide feedback |
| **Viewer** | Read-only access to incidents and dashboards |

### Permission Matrix

| Action | Owner | Admin | Engineer | Viewer |
|--------|-------|-------|----------|--------|
| View incidents | ✅ | ✅ | ✅ | ✅ |
| Create incidents | ✅ | ✅ | ✅ | ❌ |
| Update incidents | ✅ | ✅ | ✅ | ❌ |
| Delete incidents | ✅ | ✅ | ❌ | ❌ |
| Manage integrations | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ |
| Delete project | ✅ | ❌ | ❌ | ❌ |

---

## Data Protection

### Multi-Tenancy Isolation

All data is scoped to tenants and projects:

```sql
-- Every query includes tenant/project filter
SELECT * FROM incidents 
WHERE project_id = :project_id 
AND tenant_id = :tenant_id;
```

### Sensitive Data Encryption

Sensitive fields are encrypted at the application layer:

| Field | Encryption |
|-------|------------|
| Integration passwords | Fernet (AES-128) |
| API keys | Fernet (AES-128) |
| Webhook secrets | Plain (hashed for comparison) |

### Data at Rest

- PostgreSQL: Encryption enabled (Azure/cloud managed)
- Redis: Encryption in transit (TLS)

### Data in Transit

- All traffic over HTTPS (TLS 1.3)
- WebSocket connections use WSS in production

---

## API Security

### Rate Limiting

Token bucket algorithm protects against abuse:

| Tier | Limit |
|------|-------|
| Default | 100 requests/minute per IP |
| Authenticated | 100 requests/minute per user |
| AI Endpoints | 10 requests/minute |

**Rate Limit Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 85
X-RateLimit-Reset: 42
```

### Security Headers

```python
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin",
}
```

### CORS Configuration

```python
CORS_SETTINGS = {
    "allow_origins": ["https://app.sre-copilot.com"],
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE"],
    "allow_headers": ["Content-Type", "Authorization"],
    "allow_credentials": True,
    "max_age": 3600,
}
```

---

## Input Validation

### Pydantic Validation

All API inputs are validated using Pydantic:

```python
from pydantic import BaseModel, validator, constr

class IncidentCreate(BaseModel):
    title: constr(min_length=5, max_length=200)
    description: constr(min_length=10, max_length=5000)
    severity: Literal["critical", "high", "medium", "low"]
    service_name: constr(regex=r'^[a-zA-Z0-9-]+$')

    @validator('title')
    def sanitize_title(cls, v):
        # Strip HTML tags, prevent XSS
        return sanitize_html(v)
```

### Protected Against

- SQL Injection (parameterized queries via ORM)
- XSS (input sanitization, output encoding)
- CSRF (SameSite cookies)
- Command Injection (no shell execution)
- Path Traversal (validated file paths)

---

## Audit Logging

### What's Logged

| Event Type | Details |
|------------|---------|
| Authentication | Login, logout, failed attempts |
| Authorization | Permission checks, role changes |
| Data Access | Read operations on sensitive data |
| Data Modification | Create, update, delete operations |
| Admin Actions | Integration changes, member management |

### Audit Log Format

```json
{
  "id": "uuid",
  "timestamp": "2026-01-24T12:00:00Z",
  "user_id": "uuid",
  "user_email": "john@example.com",
  "tenant_id": "uuid",
  "action": "incident.update",
  "resource_type": "incident",
  "resource_id": "uuid",
  "changes": {
    "before": { "state": "detected" },
    "after": { "state": "investigating" }
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "success": true
}
```

---

## Secret Management

### Environment Variables

Secrets are stored in environment variables:

```bash
# .env (never commit to git!)
JWT_SECRET_KEY=<long-random-secret>
DATABASE_URL=postgresql://...
AZURE_OPENAI_API_KEY=<api-key>
MONITORING_ENCRYPTION_KEY=<encryption-key>
```

### Production Recommendations

1. **Use a secrets manager:**
   - Azure Key Vault
   - AWS Secrets Manager
   - HashiCorp Vault

2. **Rotate secrets regularly:**
   - JWT secret: Every 90 days
   - API keys: Every 90 days
   - Database passwords: Every 90 days

3. **Least privilege:**
   - Service accounts with minimal permissions
   - Separate keys per environment

---

## Webhook Security

### Webhook Authentication

Each integration has a unique webhook secret:

```python
# Generate secure webhook secret
webhook_secret = secrets.token_urlsafe(32)

# Verify incoming webhook
if request.headers.get('X-Webhook-Secret') != integration.webhook_secret:
    raise HTTPException(403, "Invalid webhook secret")
```

### IP Allowlisting

Restrict webhook sources to known IPs:
- Prometheus/AlertManager servers
- Grafana servers

---

## Security Checklist

### Development

- [ ] Never commit secrets to git
- [ ] Use `.env.example` for documentation
- [ ] Run security linters (bandit, safety)
- [ ] Review dependencies for vulnerabilities

### Deployment

- [ ] Enable HTTPS (TLS 1.3)
- [ ] Set `secure=True` on cookies
- [ ] Configure firewall rules
- [ ] Set up WAF (Web Application Firewall)
- [ ] Enable audit logging
- [ ] Configure rate limiting
- [ ] Set up intrusion detection

### Monitoring

- [ ] Monitor failed login attempts
- [ ] Alert on unusual API patterns
- [ ] Track audit log anomalies
- [ ] Review access logs regularly

---

## Incident Response

### Security Incident Procedure

1. **Detect:** Monitor alerts and audit logs
2. **Contain:** Disable compromised accounts/keys
3. **Investigate:** Review audit logs and access patterns
4. **Remediate:** Rotate secrets, patch vulnerabilities
5. **Report:** Document incident and lessons learned

### Contact

For security concerns, contact: security@sre-copilot.io

---

## Compliance

### Frameworks

SRE Copilot is designed to support:

- **SOC 2 Type II** - Ready
- **ISO 27001** - Ready
- **GDPR** - Compliant (data export, right to deletion)
- **PCI DSS** - Partial (no payment data stored)

---

## Related Documentation

- [System Architecture](../architecture/system-architecture.md)
- [API Specifications](../api-specs/README.md)
- [Getting Started](./getting-started.md)
