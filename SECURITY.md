# Security Improvements

## Overview
This document outlines the security enhancements implemented in the SRE Copilot application to protect against common web vulnerabilities.

## 1. HttpOnly Cookies for Authentication

### What Changed
- **Before**: JWT tokens stored in localStorage (vulnerable to XSS attacks)
- **After**: Tokens stored in secure httpOnly cookies (not accessible by JavaScript)

### Implementation
- Access tokens: 15-minute expiry, httpOnly, secure (HTTPS in production)
- Refresh tokens: 7-day expiry, httpOnly, path-restricted to `/api/v1/auth/refresh`
- SameSite policy: `lax` (CSRF protection)

### Benefits
✅ **XSS Protection**: Even if malicious JavaScript runs, it cannot access tokens
✅ **Automatic Management**: Browsers handle cookie sending automatically
✅ **Secure Transmission**: Cookies only sent over HTTPS in production

### Code Location
- Backend: `services/auth-service/app/core/security.py` - `set_auth_cookies()`
- API Gateway: `services/api-gateway/app/api/proxy.py` - `forward_response_cookies()`

## 2. Refresh Token Mechanism

### What Changed
- **Before**: Single long-lived access token
- **After**: Short-lived access tokens (15 min) + long-lived refresh tokens (7 days)

### How It Works
1. User logs in → receives both access token (15 min) and refresh token (7 days)
2. Access token expires → frontend automatically calls `/auth/refresh`
3. Refresh endpoint validates refresh token → issues new access token
4. User stays logged in without re-entering credentials

### Benefits
✅ **Reduced Attack Window**: Stolen access tokens expire quickly
✅ **Seamless UX**: Users stay logged in for 7 days without interruption
✅ **Revocable**: Refresh tokens can be blacklisted server-side

### API Endpoints
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Clear all auth cookies

## 3. Token Security Features

### Unique Token IDs (JTI)
Each token includes a `jti` (JWT ID) claim for tracking and revocation:
```python
"jti": secrets.token_urlsafe(32)  # Unique 32-byte token ID
```

### Token Type Verification
Tokens include a `type` claim to prevent token confusion attacks:
- `access` - For API requests
- `refresh` - For token refresh only

### Code Location
- `services/auth-service/app/core/security.py`

## 4. Frontend Security

### No Tokens in LocalStorage
- **Before**: `{ token: "eyJ...", user: {...} }` stored in localStorage
- **After**: Only non-sensitive UI state stored (user info, project list)

### Automatic Token Refresh
Frontend automatically refreshes expired tokens:
```typescript
// If 401 error and not already retrying
if (error.response?.status === 401 && !originalRequest._retry) {
  await api.post('/api/v1/auth/refresh')  // Get new token
  return api(originalRequest)  // Retry failed request
}
```

### WithCredentials
Axios configured to send cookies with all requests:
```typescript
withCredentials: true
```

### Code Location
- `frontend/src/services/api.ts` - Axios interceptors
- `frontend/src/lib/stores/auth-store.ts` - Updated auth store

## 5. Encryption Utility (Optional)

Created for future use when storing sensitive data locally.

### Features
- AES-GCM 256-bit encryption using Web Crypto API
- Key stored in sessionStorage (cleared on browser close)
- Base64 encoding for localStorage compatibility

### Usage Example
```typescript
import { setSecureItem, getSecureItem } from '@/lib/encryption'

// Store encrypted
await setSecureItem('sensitive-data', { secret: 'value' })

// Retrieve and decrypt
const data = await getSecureItem('sensitive-data')
```

### Code Location
- `frontend/src/lib/encryption.ts`

## 6. CORS Configuration

### Settings
- Allow credentials: `true` (required for cookies)
- Same-site policy: `lax` (CSRF protection)
- Secure flag: `true` in production (HTTPS only)

## 7. Security Headers

Recommended headers (should be added to nginx/reverse proxy in production):

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

## 8. Token Expiry

| Token Type | Expiry | Renewal |
|------------|--------|---------|
| Access Token | 15 minutes | Auto-refresh via refresh token |
| Refresh Token | 7 days | Re-login required |

## Security Checklist

### ✅ Implemented
- [x] HttpOnly cookies for tokens
- [x] Refresh token mechanism
- [x] Automatic token refresh on 401
- [x] SameSite cookie policy
- [x] Token type verification
- [x] Unique token IDs (JTI)
- [x] No tokens in localStorage
- [x] CORS with credentials
- [x] Encryption utility for sensitive data

### 🔄 Future Enhancements
- [ ] Redis-based token blacklist (for logout/revocation)
- [ ] Rate limiting on auth endpoints
- [ ] Account lockout after failed attempts
- [ ] Two-factor authentication (2FA)
- [ ] Security audit logging
- [ ] CSRF tokens for state-changing operations
- [ ] Content Security Policy (CSP) headers

## Testing Security

### 1. Test HttpOnly Cookies
Open browser DevTools → Application → Cookies → `http://localhost:8000`
- Should see `access_token` and `refresh_token` cookies
- HttpOnly flag should be checked

### 2. Test Token in LocalStorage
Open browser DevTools → Console:
```javascript
localStorage.getItem('auth-storage')
```
- Should NOT contain `token` field (or should be `null`)

### 3. Test Automatic Refresh
1. Login and wait 15 minutes
2. Make an API request
3. Check Network tab - should see `/auth/refresh` called automatically
4. Original request should succeed after refresh

### 4. Test Logout
1. Click logout
2. Check Cookies - should be cleared
3. Try accessing protected route - should redirect to login

## Migration Notes

### Backward Compatibility
- Access tokens still returned in response body for compatibility
- Frontend updated to ignore localStorage tokens
- Old sessions will need to re-login once

### User Impact
- **Existing users**: Need to login again (one-time)
- **New users**: Seamless experience with auto-refresh
- **Session duration**: 7 days (vs previous indefinite localStorage)

## Production Deployment

### Environment Variables
```env
# Auth Service
JWT_SECRET_KEY=<long-random-secret-256-bits>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
ENVIRONMENT=production

# API Gateway
CORS_ORIGINS=https://yourdomain.com
```

### HTTPS Required
In production, cookies with `secure=True` require HTTPS.

### Recommendations
1. Use a secrets manager (AWS Secrets Manager, Vault)
2. Rotate JWT secret periodically
3. Monitor failed login attempts
4. Set up security audit logging
5. Enable HTTPS with valid SSL certificate

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [HttpOnly Cookies](https://owasp.org/www-community/HttpOnly)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
