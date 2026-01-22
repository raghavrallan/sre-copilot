"""
Dummy Application for SRE Copilot Monitoring Demo
Generates realistic metrics for Prometheus scraping
"""
from fastapi import FastAPI, Response
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import random
import time
import psutil
import asyncio

app = FastAPI(title="Dummy App")

# Prometheus metrics
http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint']
)

app_cpu_usage_percent = Gauge(
    'app_cpu_usage_percent',
    'CPU usage percentage'
)

app_memory_usage_percent = Gauge(
    'app_memory_usage_percent',
    'Memory usage percentage'
)

active_connections = Gauge(
    'active_connections',
    'Number of active connections'
)

# Simulate load
load_level = {"current": "normal"}  # normal, high, critical


@app.get("/")
async def root():
    """Root endpoint"""
    start_time = time.time()

    # Simulate varying response times based on load
    if load_level["current"] == "high":
        await asyncio.sleep(random.uniform(0.5, 1.5))
    elif load_level["current"] == "critical":
        await asyncio.sleep(random.uniform(2.0, 4.0))
    else:
        await asyncio.sleep(random.uniform(0.01, 0.1))

    # Simulate occasional errors
    if random.random() < 0.05:  # 5% error rate
        status_code = 500
        http_requests_total.labels(method="GET", endpoint="/", status="500").inc()
    else:
        status_code = 200
        http_requests_total.labels(method="GET", endpoint="/", status="200").inc()

    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="GET", endpoint="/").observe(duration)

    return {"status": "ok", "load": load_level["current"]}


@app.get("/api/users")
async def get_users():
    """Users endpoint"""
    start_time = time.time()

    await asyncio.sleep(random.uniform(0.05, 0.2))

    http_requests_total.labels(method="GET", endpoint="/api/users", status="200").inc()
    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="GET", endpoint="/api/users").observe(duration)

    return {"users": [{"id": i, "name": f"User {i}"} for i in range(10)]}


@app.post("/api/orders")
async def create_order():
    """Orders endpoint"""
    start_time = time.time()

    # Simulate database write
    await asyncio.sleep(random.uniform(0.1, 0.3))

    # Simulate occasional failures
    if random.random() < 0.02:  # 2% error rate
        status_code = 500
        http_requests_total.labels(method="POST", endpoint="/api/orders", status="500").inc()
    else:
        status_code = 201
        http_requests_total.labels(method="POST", endpoint="/api/orders", status="201").inc()

    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="POST", endpoint="/api/orders").observe(duration)

    return {"status": "created" if status_code == 201 else "error"}


@app.get("/health")
async def health():
    """Health check endpoint"""
    http_requests_total.labels(method="GET", endpoint="/health", status="200").inc()
    return {"status": "healthy"}


@app.post("/simulate-load")
async def simulate_load(level: str = "normal"):
    """
    Simulate different load levels
    Options: normal, high, critical
    """
    if level not in ["normal", "high", "critical"]:
        return {"error": "Invalid load level. Use: normal, high, critical"}

    load_level["current"] = level
    return {"message": f"Load level set to {level}"}


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    # Update system metrics
    app_cpu_usage_percent.set(psutil.cpu_percent(interval=0.1))
    app_memory_usage_percent.set(psutil.virtual_memory().percent)
    active_connections.set(random.randint(10, 50))

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Background task to generate continuous traffic
@app.on_event("startup")
async def startup_event():
    """Start background metrics updater"""
    asyncio.create_task(continuous_metrics_update())


async def continuous_metrics_update():
    """Update metrics continuously"""
    while True:
        await asyncio.sleep(5)
        # Update system metrics
        app_cpu_usage_percent.set(psutil.cpu_percent(interval=0.1))
        app_memory_usage_percent.set(psutil.virtual_memory().percent)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
