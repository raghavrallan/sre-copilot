"""
Dummy Application for SRE Copilot Monitoring Demo
Generates realistic metrics and failures for Prometheus alerting
"""
from fastapi import FastAPI, Response, HTTPException
from prometheus_client import Counter, Histogram, Gauge, generate_latest, CONTENT_TYPE_LATEST
import random
import time
import psutil
import asyncio

app = FastAPI(title="Dummy App - SRE Copilot Demo")

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

database_connection_errors = Counter(
    'database_connection_errors_total',
    'Total database connection errors'
)

api_timeouts = Counter(
    'api_timeouts_total',
    'Total API timeouts',
    ['endpoint']
)

# Failure modes
failure_modes = {
    "normal": {"error_rate": 0.02, "latency_multiplier": 1, "cpu_spike": False, "memory_leak": False},
    "high_errors": {"error_rate": 0.15, "latency_multiplier": 1.5, "cpu_spike": False, "memory_leak": False},
    "high_latency": {"error_rate": 0.03, "latency_multiplier": 5, "cpu_spike": False, "memory_leak": False},
    "cpu_spike": {"error_rate": 0.05, "latency_multiplier": 2, "cpu_spike": True, "memory_leak": False},
    "memory_leak": {"error_rate": 0.03, "latency_multiplier": 1.5, "cpu_spike": False, "memory_leak": True},
    "database_failure": {"error_rate": 0.4, "latency_multiplier": 3, "cpu_spike": False, "memory_leak": False},
    "critical": {"error_rate": 0.3, "latency_multiplier": 8, "cpu_spike": True, "memory_leak": True}
}

# Current state
current_failure_mode = {"mode": "normal"}
simulated_memory_leak = {"size_mb": 0}
simulated_cpu_load = {"active": False}


@app.get("/")
async def root():
    """Root endpoint with simulated failures"""
    start_time = time.time()

    mode = failure_modes[current_failure_mode["mode"]]

    # Simulate latency based on current failure mode
    base_latency = random.uniform(0.01, 0.05)
    latency = base_latency * mode["latency_multiplier"]
    await asyncio.sleep(latency)

    # Simulate errors based on error rate
    if random.random() < mode["error_rate"]:
        http_requests_total.labels(method="GET", endpoint="/", status="500").inc()
        duration = time.time() - start_time
        http_request_duration_seconds.labels(method="GET", endpoint="/").observe(duration)
        raise HTTPException(status_code=500, detail="Internal server error - simulated failure")

    http_requests_total.labels(method="GET", endpoint="/", status="200").inc()
    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="GET", endpoint="/").observe(duration)

    return {
        "status": "ok",
        "failure_mode": current_failure_mode["mode"],
        "error_rate": f"{mode['error_rate']*100}%"
    }


@app.get("/api/users")
async def get_users():
    """Users endpoint with failure simulation"""
    start_time = time.time()

    mode = failure_modes[current_failure_mode["mode"]]
    await asyncio.sleep(random.uniform(0.05, 0.15) * mode["latency_multiplier"])

    # Simulate database connection errors
    if current_failure_mode["mode"] == "database_failure" and random.random() < 0.3:
        database_connection_errors.inc()
        http_requests_total.labels(method="GET", endpoint="/api/users", status="503").inc()
        duration = time.time() - start_time
        http_request_duration_seconds.labels(method="GET", endpoint="/api/users").observe(duration)
        raise HTTPException(status_code=503, detail="Database connection pool exhausted")

    if random.random() < mode["error_rate"]:
        http_requests_total.labels(method="GET", endpoint="/api/users", status="500").inc()
        duration = time.time() - start_time
        http_request_duration_seconds.labels(method="GET", endpoint="/api/users").observe(duration)
        raise HTTPException(status_code=500, detail="Internal server error")

    http_requests_total.labels(method="GET", endpoint="/api/users", status="200").inc()
    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="GET", endpoint="/api/users").observe(duration)

    return {"users": [{"id": i, "name": f"User {i}"} for i in range(10)]}


@app.post("/api/orders")
async def create_order():
    """Orders endpoint with failure simulation"""
    start_time = time.time()

    mode = failure_modes[current_failure_mode["mode"]]

    # Simulate database write with latency
    await asyncio.sleep(random.uniform(0.1, 0.3) * mode["latency_multiplier"])

    # Database failures
    if current_failure_mode["mode"] == "database_failure" and random.random() < 0.5:
        database_connection_errors.inc()
        http_requests_total.labels(method="POST", endpoint="/api/orders", status="503").inc()
        duration = time.time() - start_time
        http_request_duration_seconds.labels(method="POST", endpoint="/api/orders").observe(duration)
        raise HTTPException(status_code=503, detail="Database connection timeout")

    # General errors
    if random.random() < mode["error_rate"]:
        http_requests_total.labels(method="POST", endpoint="/api/orders", status="500").inc()
        duration = time.time() - start_time
        http_request_duration_seconds.labels(method="POST", endpoint="/api/orders").observe(duration)
        raise HTTPException(status_code=500, detail="Failed to create order")

    http_requests_total.labels(method="POST", endpoint="/api/orders", status="201").inc()
    duration = time.time() - start_time
    http_request_duration_seconds.labels(method="POST", endpoint="/api/orders").observe(duration)

    return {"status": "created", "order_id": random.randint(1000, 9999)}


@app.get("/health")
async def health():
    """Health check endpoint"""
    http_requests_total.labels(method="GET", endpoint="/health", status="200").inc()
    return {"status": "healthy"}


@app.post("/simulate-failure")
async def simulate_failure(mode: str = "normal"):
    """
    Simulate different failure modes to trigger Prometheus alerts

    Available modes:
    - normal: 2% error rate, normal latency
    - high_errors: 15% error rate (triggers HighErrorRate alert)
    - high_latency: 5x latency (triggers HighLatency alert)
    - cpu_spike: High CPU usage (triggers HighCPUUsage alert)
    - memory_leak: Growing memory usage (triggers HighMemoryUsage alert)
    - database_failure: Database connection errors (40% error rate)
    - critical: Multiple simultaneous failures (30% errors, 8x latency, CPU+memory issues)
    """
    if mode not in failure_modes:
        return {
            "error": "Invalid failure mode",
            "available_modes": list(failure_modes.keys())
        }

    current_failure_mode["mode"] = mode

    # Reset simulations if returning to normal
    if mode == "normal":
        simulated_memory_leak["size_mb"] = 0
        simulated_cpu_load["active"] = False

    # Activate specific simulations
    if failure_modes[mode]["cpu_spike"]:
        simulated_cpu_load["active"] = True

    if failure_modes[mode]["memory_leak"]:
        simulated_memory_leak["size_mb"] = 100  # Start memory leak

    return {
        "message": f"Failure mode set to: {mode}",
        "config": failure_modes[mode],
        "info": "Generate traffic to trigger alerts"
    }


@app.get("/failure-status")
async def failure_status():
    """Get current failure mode status"""
    return {
        "current_mode": current_failure_mode["mode"],
        "config": failure_modes[current_failure_mode["mode"]],
        "memory_leak_mb": simulated_memory_leak["size_mb"],
        "cpu_spike_active": simulated_cpu_load["active"]
    }


@app.post("/generate-traffic")
async def generate_traffic(requests: int = 100):
    """
    Generate traffic to trigger alerts
    Makes multiple requests to endpoints to simulate load
    """
    results = {"total": requests, "errors": 0, "success": 0}

    for _ in range(requests):
        try:
            # Random endpoint selection
            endpoint_choice = random.choice(["/", "/api/users"])
            if endpoint_choice == "/":
                await root()
            else:
                await get_users()
            results["success"] += 1
        except HTTPException:
            results["errors"] += 1

        await asyncio.sleep(0.01)  # Small delay between requests

    return {
        "message": f"Generated {requests} requests",
        "results": results,
        "error_rate": f"{(results['errors']/requests)*100:.1f}%"
    }


@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint with simulated failures"""
    # Get actual system metrics
    actual_cpu = psutil.cpu_percent(interval=0.1)
    actual_memory = psutil.virtual_memory().percent

    # Apply simulations
    if simulated_cpu_load["active"]:
        # Simulate high CPU (80-95%)
        simulated_cpu = random.uniform(80, 95)
        app_cpu_usage_percent.set(simulated_cpu)
    else:
        app_cpu_usage_percent.set(actual_cpu)

    if simulated_memory_leak["size_mb"] > 0:
        # Simulate growing memory usage (85-95%)
        simulated_memory = min(95, 85 + (simulated_memory_leak["size_mb"] / 100) * 10)
        app_memory_usage_percent.set(simulated_memory)
        # Grow memory leak over time
        simulated_memory_leak["size_mb"] = min(1000, simulated_memory_leak["size_mb"] + 5)
    else:
        app_memory_usage_percent.set(actual_memory)

    # Simulate active connections based on failure mode
    mode = failure_modes[current_failure_mode["mode"]]
    if mode["latency_multiplier"] > 3:
        # High latency means more concurrent connections
        active_connections.set(random.randint(50, 100))
    else:
        active_connections.set(random.randint(5, 30))

    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# Background task to generate continuous traffic
@app.on_event("startup")
async def startup_event():
    """Start background metrics updater"""
    asyncio.create_task(continuous_metrics_update())
    print("🚀 Dummy App started - Ready to simulate failures!")
    print("📊 Use POST /simulate-failure?mode=<mode> to trigger failures")
    print("📈 Use POST /generate-traffic to create load")


async def continuous_metrics_update():
    """Update metrics continuously and simulate background load"""
    while True:
        await asyncio.sleep(5)

        # Get actual system metrics
        actual_cpu = psutil.cpu_percent(interval=0.1)
        actual_memory = psutil.virtual_memory().percent

        # Apply simulations
        if simulated_cpu_load["active"]:
            simulated_cpu = random.uniform(80, 95)
            app_cpu_usage_percent.set(simulated_cpu)
        else:
            app_cpu_usage_percent.set(actual_cpu)

        if simulated_memory_leak["size_mb"] > 0:
            simulated_memory = min(95, 85 + (simulated_memory_leak["size_mb"] / 100) * 10)
            app_memory_usage_percent.set(simulated_memory)
            simulated_memory_leak["size_mb"] = min(1000, simulated_memory_leak["size_mb"] + 2)
        else:
            app_memory_usage_percent.set(actual_memory)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
