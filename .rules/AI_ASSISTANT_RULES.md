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
- `docker-compose.yml` - Service definitions
- `.env` - Environment configuration
- `services/api-gateway/app/api/proxy.py` - API routing
- `shared/models/` - Database models
- `frontend/src/services/api.ts` - API client configuration

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
docker ps

# Check logs
docker logs sre-copilot-<service> --tail 50

# Test API endpoint
curl -s http://localhost:8080/api/v1/endpoint
```

### After Frontend Changes
1. Check browser console for errors
2. Verify network requests in DevTools
3. Test user flows end-to-end

### After Backend Changes
1. Rebuild affected containers: `docker-compose up -d --build <service>`
2. Check service logs for startup errors
3. Test API with curl

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
