# SRE Copilot - Testing Guide

**Last Updated:** 2026-02-01

---

## Overview

This document describes the comprehensive testing strategy for the SRE Copilot platform, including unit tests, integration tests, and end-to-end tests.

---

## Test Structure

```
tests/
├── unit/                           # Unit tests for individual components
│   ├── test_websocket_service.py   # WebSocket service tests
│   ├── test_audit_service.py       # Audit service tests
│   ├── test_encryption.py          # Encryption module tests
│   └── ...
│
├── integration/                    # Integration tests for service interactions
│   └── test_end_to_end_flows.py    # End-to-end workflow tests
│
└── conftest.py                     # Shared test fixtures and configuration
```

---

## Running Tests

### Prerequisites

```bash
# Install test dependencies
pip install pytest pytest-asyncio pytest-cov httpx

# Ensure all services are running
docker-compose up -d
```

### Run All Tests

```bash
# From project root
pytest tests/ -v

# With coverage report
pytest tests/ -v --cov=services --cov-report=html

# Run only unit tests
pytest tests/unit/ -v

# Run only integration tests
pytest tests/integration/ -v -m integration
```

### Run Specific Test Files

```bash
# Test WebSocket service
pytest tests/unit/test_websocket_service.py -v

# Test Audit service
pytest tests/unit/test_audit_service.py -v

# Test Encryption
pytest tests/unit/test_encryption.py -v

# Test end-to-end flows
pytest tests/integration/test_end_to_end_flows.py -v -m integration
```

### Run Specific Test Methods

```bash
# Run specific test class
pytest tests/unit/test_websocket_service.py::TestWebSocketHealth -v

# Run specific test method
pytest tests/unit/test_encryption.py::TestEncryptionDecryption::test_encrypt_decrypt_roundtrip -v
```

---

## Unit Tests

### WebSocket Service Tests

**File:** `tests/unit/test_websocket_service.py`

**Coverage:**
- Health endpoint
- Statistics endpoint
- Connection manager (connect/disconnect)
- Channel subscriptions
- Tenant isolation
- Authentication

**Example:**
```python
def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "websocket-service"
```

### Audit Service Tests

**File:** `tests/unit/test_audit_service.py`

**Coverage:**
- CRUD operations
- Filtering and pagination
- User activity tracking
- Resource history
- Statistics calculations

### Encryption Module Tests

**File:** `tests/unit/test_encryption.py`

**Coverage:**
- Key derivation (PBKDF2)
- Session key management
- Encrypt/decrypt roundtrip
- Error handling (wrong key, invalid payload)
- Complex data structures

---

## Integration Tests

### End-to-End Flow Tests

**File:** `tests/integration/test_end_to_end_flows.py`

**Test Flows:**

1. **Incident Creation Flow**
   ```
   Create Incident → Incident Service → AI Service → 
   Generate Hypotheses → Save to DB
   ```

2. **Alert to Incident Flow**
   ```
   Prometheus Alert → AlertManager → Integration Service →
   Create Incident → AI Hypotheses
   ```

3. **Audit Logging Flow**
   ```
   User Action → Create Audit Log → Retrieve Audit Logs →
   Verify Logging
   ```

---

## Test Coverage Goals

| Component | Target | Current |
|-----------|--------|---------|
| WebSocket Service | 80% | ~85% |
| Audit Service | 80% | ~90% |
| Encryption Module | 90% | ~95% |
| Incident Service | 80% | In Progress |
| AI Service | 70% | In Progress |
| Integration Service | 75% | In Progress |
| End-to-End Flows | 70% | ~75% |

---

## Best Practices

### Writing Tests

1. **Test Naming**
   - Use descriptive names: `test_<action>_<expected_result>`
   - Example: `test_create_incident_returns_201`

2. **Test Structure (AAA Pattern)**
   ```python
   def test_something():
       # Arrange: Set up test data
       data = {"key": "value"}

       # Act: Perform the action
       result = function_under_test(data)

       # Assert: Verify the result
       assert result == expected_value
   ```

3. **Fixtures Over Setup/Teardown**
   - Use pytest fixtures for reusable test data
   - Prefer function-scoped fixtures

4. **Async Tests**
   ```python
   @pytest.mark.asyncio
   async def test_async_function():
       result = await async_function()
       assert result is not None
   ```

5. **Mocking External Services**
   ```python
   from unittest.mock import patch, Mock

   @patch('app.external_api.call')
   def test_with_mock(mock_call):
       mock_call.return_value = {"status": "success"}
       result = function_that_calls_api()
       assert result == expected
   ```

---

## Test Markers

```python
# Mark integration tests
@pytest.mark.integration
def test_integration_flow():
    pass

# Mark slow tests
@pytest.mark.slow
def test_expensive_operation():
    pass

# Skip test conditionally
@pytest.mark.skipif(condition, reason="...")
def test_conditional():
    pass
```

**Run specific markers:**
```bash
# Run only integration tests
pytest -m integration

# Run everything except slow tests
pytest -m "not slow"
```

---

## Code Coverage

### Generate Coverage Report

```bash
# HTML report
pytest tests/ --cov=services --cov-report=html

# Terminal report
pytest tests/ --cov=services --cov-report=term

# XML report (for CI)
pytest tests/ --cov=services --cov-report=xml
```

### View HTML Report

```bash
# Open in browser
open htmlcov/index.html   # macOS
start htmlcov/index.html  # Windows
```

---

## Debugging Tests

### Verbose Output

```bash
# Show print statements
pytest tests/ -v -s

# Show local variables on failure
pytest tests/ -v -l

# Stop on first failure
pytest tests/ -v -x

# Enter debugger on failure
pytest tests/ -v --pdb
```

### Test Isolation

```bash
# Run tests in random order
pytest tests/ --random-order

# Run single test file
pytest tests/unit/test_encryption.py -v

# Run single test
pytest tests/unit/test_encryption.py::test_encrypt_decrypt_roundtrip -v
```

---

## Frontend Testing

### Run Frontend Tests

```bash
cd frontend
npm install
npm run test
npm run test:coverage
```

### Test Structure

```
frontend/src/
├── tests/
│   ├── setup.ts           # Test setup
│   └── unit/
│       └── LoginPage.test.tsx
```

---

## CI/CD Integration

### GitHub Actions Workflow

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests

**Backend CI:**
- Runs auth-service and incident-service tests
- Runs linters (ruff, black)
- Builds Docker images

**Frontend CI:**
- Lints TypeScript code
- Runs unit tests with coverage
- Builds production bundle

---

## Troubleshooting

### Import Errors

```bash
# Add services to Python path
export PYTHONPATH="${PYTHONPATH}:services/websocket-service:services/audit-service"
```

### Services Not Running

```bash
# Check if services are up
docker-compose ps

# Start services
docker-compose up -d
```

### Database Connection Issues

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres redis
```

### Async Test Issues

```python
# Ensure pytest-asyncio is installed
pip install pytest-asyncio

# Add marker to async tests
@pytest.mark.asyncio
async def test_async():
    pass
```

---

## Related Documentation

- [Getting Started](./getting-started.md)
- [System Architecture](../architecture/system-architecture.md)
- [API Specifications](../api-specs/README.md)
