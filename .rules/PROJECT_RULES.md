# SRE Copilot - Project-Specific Rules

## Critical Rules (MUST Follow)

### 1. Never Hardcode Values
- **URLs**: Always fetch from database or environment variables
- **IDs**: Never hardcode project_id, tenant_id, user_id
- **Secrets**: Use environment variables, never commit secrets
- **Configuration**: Use .env files and config modules

```python
# BAD
url = "http://localhost:9090"

# GOOD
url = integration.url  # From database
url = os.getenv("PROMETHEUS_URL")
```

### 2. Authentication via Cookies
- Frontend uses cookies for authentication (not localStorage tokens)
- All API calls must include `credentials: 'include'`
- Backend must check both Authorization header AND cookies

```python
# Backend - Always support both auth methods
def get_token_from_request(request, authorization=None):
    token = None
    if authorization:
        parts = authorization.split()
        if len(parts) == 2 and parts[0].lower() == "bearer":
            token = parts[1]
    if not token:
        token = request.cookies.get("access_token")
    return token
```

### 3. API Gateway Pattern
- All frontend requests MUST go through API gateway (port 8080)
- API gateway handles auth and forwards to microservices
- Never expose microservices directly to frontend
- Always include `project_id` when forwarding requests

### 4. Multi-Tenancy Isolation
- Every query MUST filter by `tenant_id` or `project_id`
- Never return data from other tenants
- JWT contains tenant_id and project_id for validation

### 5. Error Handling
- Always return meaningful error messages
- On 401, frontend redirects to login and clears cookies
- Log errors with context (user_id, project_id, request_id)

## API Conventions

### Endpoint Patterns
```
GET    /api/v1/resources              # List (with pagination)
POST   /api/v1/resources              # Create
GET    /api/v1/resources/{id}         # Get single
PATCH  /api/v1/resources/{id}         # Partial update
DELETE /api/v1/resources/{id}         # Delete
GET    /api/v1/resources/{id}/sub     # Nested resource
POST   /api/v1/resources/{id}/action  # Custom action
```

### Query Parameters
- `project_id` - Required for all project-scoped resources
- `page`, `limit` - Pagination (default: page=1, limit=20)
- `search` - Text search
- `state`, `severity` - Filters

### Response Format
```json
// List response
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 20,
  "pages": 5
}

// Single resource
{
  "id": "uuid",
  "field": "value",
  ...
}

// Error
{
  "detail": "Error message"
}
```

## Frontend Rules

### Component Organization
```
components/
├── settings/           # Settings page components
├── workflow/           # Incident workflow components
├── common/             # Shared components (Button, Modal, etc.)
└── [feature]/          # Feature-specific components
```

### State Management
- **Auth state**: Zustand store (`auth-store.ts`)
- **Server data**: Fetch in component, refresh on WebSocket events
- **UI state**: Local component state

### WebSocket Usage
```tsx
// Subscribe to events
useWebSocketEvent<Incident>('incident.created', (data) => {
  setIncidents(prev => [data, ...prev])
})

// Show toast notifications
useWebSocketEvent<Incident>('incident.updated', (data) => {
  toast.info(`Incident ${data.title} updated`)
})
```

## Backend Rules

### Service Communication
- Services communicate via HTTP (not direct DB access)
- Use Redis pub/sub for real-time events
- API gateway is the only public entry point

### Database Operations
- Use Django ORM async methods (`acreate`, `aget`, `asave`)
- Always use transactions for multi-step operations
- Add proper indexes for query performance

### Logging
```python
# Include context
print(f"✅ Created incident {incident.id} for project {project_id}")
print(f"❌ Failed to process webhook: {error}")
```

## Docker & Infrastructure

### Container Naming
- Use `sre-copilot-` prefix for all containers
- Monitoring containers use `sre-` prefix (prometheus, grafana, etc.)

### Network
- All services on `sre-copilot_sre-network`
- Monitoring services connected to same network
- Use container names for inter-service communication

### Environment Variables
```
# Database
POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB

# Redis
REDIS_URL=redis://redis:6379/0

# JWT
JWT_SECRET_KEY, JWT_ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES

# Service URLs (internal)
AUTH_SERVICE_URL=http://auth-service:8001
INCIDENT_SERVICE_URL=http://incident-service:8002
```

## Git Conventions

### Branch Naming
- `feat/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation

### Commit Messages
```
feat: Add incident comments and activity timeline
fix: Resolve 401 error on project switch
refactor: Extract common auth logic
docs: Update API documentation
```

## Performance Guidelines

### Frontend
- Lazy load routes/components
- Debounce search inputs
- Use pagination for large lists
- Cache API responses where appropriate

### Backend
- Use database indexes
- Implement pagination
- Use async/await for I/O operations
- Cache frequently accessed data in Redis

## Security Rules

### Never Do
- Store passwords in plain text
- Log sensitive data (passwords, tokens)
- Expose internal service errors to users
- Allow SQL injection (use ORM)
- Allow XSS (sanitize user input)

### Always Do
- Validate all user inputs
- Use parameterized queries
- Hash passwords with bcrypt
- Use HTTPS in production
- Set proper CORS headers
