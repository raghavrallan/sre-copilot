# AI Assistant Rules for SRE Copilot

## Context Awareness

### Project Stack
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: FastAPI (Python 3.11) + Django ORM
- **Database**: PostgreSQL (external, not containerized)
- **Cache/PubSub**: Redis
- **Monitoring**: Prometheus + Grafana + AlertManager
- **Containerization**: Docker Compose

### Key Files to Reference
- `docker-compose.yml` - Service definitions (14 backend services + frontend + Redis)
- `.env` - Environment configuration (DB, Redis, Azure OpenAI, JWT)
- `services/api-gateway/app/api/proxy.py` - Auth, incident, AI proxy routes
- `services/api-gateway/app/api/observability_proxy.py` - Metrics, logs, alerts, synthetic, security, CI/CD, cloud routes
- `services/api-gateway/app/api/ingest_proxy.py` - Public ingest API (API-key auth)
- `services/api-gateway/app/core/config.py` - All service URLs (ports 8501-8515)
- `shared/models/` - Django ORM models (tenant, incident, observability, cloud, cicd)
- `shared/utils/responses.py` - Centralized validation and response helpers
- `frontend/src/services/api.ts` - API client configuration
- `frontend/src/contexts/WebSocketContext.tsx` - Real-time WebSocket connection

## Before Making Changes

### Always Check First
1. **Read related files** before modifying
2. **Check existing patterns** in similar components/services
3. **Verify API endpoints** exist in gateway proxy
4. **Check database models** for required fields

### Questions to Ask
- Does the API endpoint exist in the gateway?
- Is this data multi-tenant scoped?
- Will this break existing functionality?
- Is there a similar pattern already implemented?

## Code Generation Rules

### Frontend Components
```tsx
// Always follow this structure:
// 1. Import from React, then external libs, then internal
// 2. Define interfaces
// 3. Define constants (STATES, SEVERITIES, etc.)
// 4. Export default function component
// 5. Use hooks at top of component
// 6. Define handlers
// 7. Return JSX
```

### Backend Endpoints
```python
# Always follow this structure:
# 1. Define Pydantic models for request/response
# 2. Add proper type hints
# 3. Validate user authentication
# 4. Include project_id in queries
# 5. Handle errors with HTTPException
# 6. Return typed response
```

### API Gateway Proxy
```python
# When adding new endpoint:
# 1. Add route in proxy.py
# 2. Use get_current_user_from_token dependency
# 3. Forward request to appropriate service
# 4. Include project_id from user context
# 5. Handle response and errors
```

## Common Pitfalls to Avoid

### 1. Missing API Gateway Route
- **Symptom**: 404 on frontend API call
- **Fix**: Add route to `services/api-gateway/app/api/proxy.py`

### 2. Authentication Errors
- **Symptom**: 401 Unauthorized
- **Check**: Token in cookies, gateway reading cookies, service accepting token

### 3. CORS Issues
- **Symptom**: CORS error in browser
- **Check**: CORS middleware in gateway, allowed origins

### 4. Missing project_id
- **Symptom**: 422 Unprocessable Entity
- **Fix**: Ensure project_id passed from gateway to service

### 5. Database Table Missing
- **Symptom**: Table doesn't exist error
- **Fix**: Create table via psql or Django migration

### 6. SynchronousOnlyOperation in Async Endpoints
- **Symptom**: `django.core.exceptions.SynchronousOnlyOperation`
- **Fix**: Wrap Django ORM calls with `@sync_to_async` and `await` them in async endpoints

### 7. Django Version vs PostgreSQL Incompatibility
- **Symptom**: `django.db.utils.NotSupportedError: PostgreSQL 14 or later is required`
- **Fix**: Pin Django to 5.0.x in requirements.txt (our DB is PostgreSQL 13)

### 8. Missing Service URL in API Gateway Config
- **Symptom**: `AttributeError: 'Settings' object has no attribute 'X_SERVICE_URL'`
- **Fix**: Add the service URL to `services/api-gateway/app/core/config.py`

### 9. WebSocket Connection Failures
- **Symptom**: Frontend shows "Offline" or "Failed to connect to real-time updates"
- **Fix**: Check that websocket-service port 8505 is mapped in docker-compose.yml, CORS is configured, and frontend has correct `VITE_WEBSOCKET_URL`

## File Modification Rules

### When Modifying Frontend
1. Update types in `frontend/src/types/` if adding new fields
2. Check if WebSocket events need updating
3. Ensure API paths include `/api/v1/` prefix
4. Use `toast` for user feedback

### When Modifying Backend
1. Update both service AND gateway proxy
2. Add new models to `shared/models/`
3. Create database tables/migrations
4. Publish WebSocket events for real-time updates

### When Adding New Service
1. Add to `docker-compose.yml`
2. Create Dockerfile
3. Add to gateway proxy routes
4. Configure environment variables
5. Connect to shared network

## Testing Changes

### Quick Verification
```bash
# Check container status
docker compose ps

# Check logs
docker compose logs --tail 50 <service-name>

# Test API endpoint (API Gateway external port is 8580)
curl -s http://localhost:8580/api/v1/endpoint
```

### After Frontend Changes
1. Check browser console for errors
2. Verify network requests in DevTools
3. Test user flows end-to-end

### After Backend Changes
1. Rebuild affected containers: `docker compose up -d --build <service>`
2. Check service logs for startup errors
3. Test API with curl (gateway port 8580)

## Commit Guidelines

### Before Committing
1. Ensure all services start without errors
2. Test the feature/fix manually
3. Check for console errors in browser
4. Verify no hardcoded values

### Commit Message Format
```
<type>: <short description>

- Detail 1
- Detail 2

Co-Authored-By: Claude <noreply@anthropic.com>
```

## When Stuck

### Debug Steps
1. Check Docker logs for the specific service
2. Verify environment variables
3. Check network connectivity between services
4. Verify database tables exist
5. Check API gateway routes

### Common Fixes
- **Service not starting**: Check logs, verify dependencies
- **API 404**: Add route to gateway proxy
- **API 401**: Check auth flow, verify cookies
- **API 422**: Check required parameters
- **API 500**: Check service logs for actual error
