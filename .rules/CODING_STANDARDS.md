# SRE Copilot - Coding Standards

## General Principles

1. **KISS (Keep It Simple, Stupid)** - Write simple, readable code over clever solutions
2. **DRY (Don't Repeat Yourself)** - Extract common logic into reusable functions
3. **Single Responsibility** - Each function/component should do one thing well
4. **Fail Fast** - Validate inputs early and return/throw errors immediately

## Project Structure

```
sre-copilot/
├── frontend/                 # React + TypeScript frontend
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/           # Page components (one per route)
│   │   ├── services/        # API client functions
│   │   ├── lib/stores/      # Zustand state stores
│   │   ├── hooks/           # Custom React hooks
│   │   ├── contexts/        # React contexts
│   │   └── types/           # TypeScript interfaces
├── services/                 # Backend microservices (14 services)
│   ├── api-gateway/         # Port 8500 (ext 8580) - Request routing, auth
│   ├── auth-service/        # Port 8501 - Authentication, RBAC
│   ├── incident-service/    # Port 8502 - Incident management
│   ├── ai-service/          # Port 8503 - AI hypothesis (Azure OpenAI)
│   ├── integration-service/ # Port 8504 - Prometheus webhooks
│   ├── websocket-service/   # Port 8505 - Real-time WebSocket
│   ├── audit-service/       # Port 8508 - Audit logging
│   ├── metrics-collector-service/ # Port 8509 - Metrics, traces, errors, SLOs
│   ├── log-service/         # Port 8510 - Log ingestion & search
│   ├── alerting-service/    # Port 8511 - Alert policies
│   ├── synthetic-service/   # Port 8512 - HTTP monitors
│   ├── security-service/    # Port 8513 - Vulnerability tracking
│   ├── cloud-connector-service/ # Port 8514 - AWS/Azure/GCP sync
│   └── cicd-connector-service/  # Port 8515 - CI/CD integration
├── shared/                   # Shared Django models & utils
│   ├── models/              # Django ORM models
│   ├── config/              # Django settings
│   └── utils/               # responses.py (validation), internal_auth.py
└── monitoring/              # Prometheus, Grafana configs
```

## Frontend Standards (React + TypeScript)

### Component Structure
```tsx
// 1. Imports (external, internal, types, styles)
import { useState, useEffect } from 'react'
import api from '../services/api'
import { MyType } from '../types'

// 2. Interface definitions
interface Props {
  id: string
  onSuccess?: () => void
}

// 3. Component definition (use function declaration)
export default function MyComponent({ id, onSuccess }: Props) {
  // 4. Hooks first
  const [data, setData] = useState<MyType | null>(null)
  const [loading, setLoading] = useState(true)

  // 5. Effects
  useEffect(() => {
    fetchData()
  }, [id])

  // 6. Handler functions
  const fetchData = async () => {
    // implementation
  }

  // 7. Render
  return (
    <div>...</div>
  )
}
```

### Naming Conventions
- **Components**: PascalCase (`UserProfile.tsx`)
- **Files**: PascalCase for components, camelCase for utilities
- **Functions**: camelCase (`fetchUserData`)
- **Constants**: SCREAMING_SNAKE_CASE (`API_BASE_URL`)
- **Types/Interfaces**: PascalCase (`UserProfile`)
- **Boolean props**: Prefix with `is`, `has`, `should` (`isLoading`, `hasError`)

### State Management
- Use Zustand for global state
- Use React Query for server state (if needed)
- Use local state for UI-only state
- Never store derived state

### API Calls
- Always use the `api` service (configured with credentials)
- Handle loading, error, and success states
- Show toast notifications for user actions

```tsx
const handleSubmit = async () => {
  setLoading(true)
  try {
    await api.post('/api/v1/resource', data)
    toast.success('Saved successfully')
    onSuccess?.()
  } catch (error) {
    toast.error('Failed to save')
  } finally {
    setLoading(false)
  }
}
```

## Backend Standards (FastAPI + Django)

### API Endpoint Structure
```python
from shared.utils.responses import validate_project_id, success_response, error_response

@router.post("/resource")
async def create_resource(
    request: CreateResourceRequest,
    project_id: str = Query(...),
):
    """Create a new resource"""
    # 1. Validate project_id (returns 400 if invalid)
    validate_project_id(project_id)

    # 2. Business logic (use sync_to_async for ORM calls)
    try:
        resource = await _create_resource(project_id, request)
    except Exception as e:
        return error_response(500, str(e))

    # 3. Return consistent response
    return success_response({"resource": resource_to_dict(resource)})
```

### Django ORM in Async Endpoints (sync_to_async)

Django ORM operations are synchronous. In async FastAPI endpoints, wrap them with `sync_to_async`:

```python
from asgiref.sync import sync_to_async

@sync_to_async
def _get_resources(project_id):
    return list(Resource.objects.filter(project_id=project_id))

@sync_to_async
def _create_resource(project_id, data):
    return Resource.objects.create(project_id=project_id, **data)

@router.get("/resources")
async def list_resources(project_id: str = Query(...)):
    validate_project_id(project_id)
    resources = await _get_resources(project_id)
    return success_response({"resources": resources})
```

**Important:** Do NOT call Django ORM methods directly in async functions -- this raises `SynchronousOnlyOperation`.

### Django Models
- Always use UUIDs for primary keys
- Add proper indexes for frequently queried fields
- Use `app_label = 'shared'` for shared models
- Define `__str__` method for debugging

### Error Handling
- Use HTTPException with appropriate status codes
- Always include meaningful error messages
- Log errors with context

## API Gateway Proxy Pattern

All frontend requests go through the API gateway which:
1. Validates authentication (cookie or header)
2. Extracts user context from JWT
3. Forwards request to appropriate microservice
4. Includes project_id from JWT in forwarded requests

```python
@router.get("/resource/{id}")
async def get_resource(
    id: str,
    user=Depends(get_current_user_from_token)
):
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")

    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{SERVICE_URL}/resource/{id}",
            params={"project_id": user["project_id"]}
        )
        return response.json()
```

## Authentication

### Cookie-Based Auth
- Access token stored in HTTP-only cookie
- All API calls include `credentials: 'include'`
- Token refresh handled automatically

### JWT Claims
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tenant_id": "tenant-uuid",
  "project_id": "project-uuid",
  "project_role": "owner|admin|engineer|viewer",
  "role": "admin|user"
}
```

## WebSocket Real-time Updates

### Event Types
- `incident.created` - New incident detected
- `incident.updated` - Incident state/severity changed
- `hypothesis.generated` - AI generated new hypothesis
- `alert.fired` - New alert from monitoring

### Publishing Events
```python
await redis_publisher.publish_incident_created(
    incident_data={...},
    tenant_id=str(project.tenant_id)
)
```

## Database Conventions

### Table Naming
- Use snake_case plural (`incidents`, `hypotheses`)
- Junction tables: `{table1}_{table2}` (`project_members`)

### Common Fields
- `id` - UUID primary key
- `created_at` - Auto-set on creation
- `updated_at` - Auto-updated on modification
- `tenant_id` - Multi-tenancy isolation
- `project_id` - Project scoping

## Testing

- Unit tests for utility functions
- Integration tests for API endpoints
- Use meaningful test names: `test_should_create_incident_when_valid_data`
