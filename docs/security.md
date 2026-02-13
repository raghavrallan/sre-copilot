# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in SRE Copilot, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities.
2. Email your findings to the project maintainers.
3. Include the following in your report:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours.
- **Assessment**: We will assess the vulnerability and determine its severity within 5 business days.
- **Fix Timeline**: Critical vulnerabilities will be patched within 7 days. High severity within 14 days.
- **Disclosure**: We will coordinate disclosure with you after a fix is available.

## Security Measures

This project implements the following security measures:

### Authentication & Authorization
- JWT-based authentication with httpOnly cookies
- Role-based access control (Owner, Admin, Engineer, Viewer)
- Service-to-service authentication via internal service keys
- Password strength validation

### API Security
- Rate limiting (100 requests/minute per IP)
- CORS restricted to known origins (API Gateway only)
- Input validation with Pydantic (field length limits, enum types)
- Global exception handler that hides internal details in production

### Infrastructure
- Non-root Docker containers
- Network segmentation (frontend/backend networks)
- No backend service ports exposed to host
- Secrets validated at startup (no placeholder values in production)

### Monitoring
- Structured logging (no sensitive data in logs)
- Audit logging for all API operations
- Prometheus metrics collection

### CI/CD
- Automated dependency vulnerability scanning (pip-audit, npm audit)
- Static analysis security testing (Bandit)
- Dependabot for automated dependency updates

## Security Checklist for Deployment

- [ ] Set strong `JWT_SECRET_KEY` (at least 32 random characters)
- [ ] Set strong `INTERNAL_SERVICE_KEY`
- [ ] Set strong `ENCRYPTION_MASTER_KEY`
- [ ] Change Grafana admin password from default
- [ ] Enable HTTPS (set `Secure=True` on cookies)
- [ ] Set `ENVIRONMENT=production` on all services
- [ ] Review and restrict CORS origins for your domain
- [ ] Run `pip-audit` and `npm audit` before deployment
- [ ] Ensure PostgreSQL uses strong credentials
- [ ] Configure Redis with authentication
