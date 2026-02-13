# SRE Copilot Python SDK

Auto-instrumentation SDK for FastAPI applications. Emits APM metrics to the SRE Copilot metrics-collector-service.

## Installation

```bash
pip install -e .
```

Or from the project root:

```bash
pip install -e sdk/python/
```

## Usage

### Add Middleware to FastAPI

```python
from fastapi import FastAPI
from sre_copilot_sdk import SRECopilotMiddleware, SRECopilotClient

app = FastAPI()

# Create client and add middleware
sre_client = SRECopilotClient(
    collector_url="http://metrics-collector:8509",
    service_name="my-service",
    flush_interval=10.0,
    batch_size=100,
)

app.add_middleware(SRECopilotMiddleware, client=sre_client, service_name="my-service")

@app.on_event("startup")
async def startup():
    await sre_client.start()

@app.on_event("shutdown")
async def shutdown():
    await sre_client.stop()

@app.get("/api/hello")
async def hello():
    return {"message": "Hello"}
```

### Custom Metrics

```python
# Record a custom gauge
sre_client.record_metric("queue.size", 42, metric_type="gauge", tags={"queue": "tasks"})

# Record an error
sre_client.record_error("ConnectionError", "Database connection failed", stack_trace="...")
```

### Exclude Paths

By default, `/health`, `/docs`, `/openapi.json`, and `/redoc` are excluded from instrumentation. Customize via `exclude_paths`:

```python
app.add_middleware(
    SRECopilotMiddleware,
    client=sre_client,
    service_name="my-service",
    exclude_paths=["/health", "/metrics", "/ready"],
)
```

## Configuration

| Parameter       | Default                             | Description                    |
|----------------|--------------------------------------|--------------------------------|
| `collector_url` | `http://localhost:8580/api/v1/ingest` | Metrics collector (API gateway) URL |
| `service_name` | `unknown`                             | Service name for metrics       |
| `flush_interval` | `10.0`                             | Seconds between batch flushes  |
| `batch_size`   | `100`                                | Max metrics per batch          |
| `api_key`      | `""`                                 | API key for authentication (required when using the public API gateway) |
