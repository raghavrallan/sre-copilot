"""
Demo data generators for metrics-collector-service.
Generates realistic demo data for all features when storage is empty.
"""
import logging
import random
import uuid
from datetime import datetime, timedelta
from typing import Any

logger = logging.getLogger(__name__)

SERVICES = [
    "api-gateway",
    "auth-service",
    "incident-service",
    "ai-service",
    "integration-service",
    "websocket-service",
    "audit-service",
]


def generate_demo_transactions() -> list[dict[str, Any]]:
    """Generate 100+ transactions across 7 services."""
    transactions = []
    endpoints = [
        ("/api/v1/incidents", "GET", 200),
        ("/api/v1/incidents", "POST", 201),
        ("/api/v1/incidents/{id}", "GET", 200),
        ("/api/v1/auth/login", "POST", 200),
        ("/api/v1/auth/refresh", "POST", 200),
        ("/api/v1/projects", "GET", 200),
        ("/api/v1/webhooks", "GET", 200),
        ("/api/v1/webhooks", "POST", 201),
        ("/api/v1/ai/generate-hypotheses", "POST", 200),
        ("/ws/events", "GET", 101),
        ("/audit-logs", "GET", 200),
        ("/health", "GET", 200),
    ]

    base_time = datetime.utcnow() - timedelta(hours=24)
    for i in range(120):
        service = random.choice(SERVICES)
        endpoint, method, status = random.choice(endpoints)
        duration = random.gauss(45, 25)
        duration = max(5, min(500, duration))
        db_duration = random.gauss(duration * 0.3, 10) if random.random() > 0.3 else 0
        db_duration = max(0, min(duration * 0.8, db_duration))
        external_duration = random.gauss(duration * 0.2, 5) if random.random() > 0.5 else 0
        external_duration = max(0, min(duration * 0.5, external_duration))

        error = None
        if random.random() < 0.02:
            status = random.choice([500, 502, 503])
            error = "Internal server error"

        ts = base_time + timedelta(minutes=i * 12 + random.randint(0, 10))
        transactions.append({
            "transaction_id": str(uuid.uuid4()),
            "service_name": service,
            "endpoint": endpoint,
            "method": method,
            "status_code": status,
            "duration_ms": round(duration, 2),
            "db_duration_ms": round(db_duration, 2),
            "external_duration_ms": round(external_duration, 2),
            "timestamp": ts.isoformat() + "Z",
            "error": error,
        })
    return transactions


def generate_demo_traces() -> list[dict[str, Any]]:
    """Generate 20+ traces with spans (api-gateway -> auth-service -> postgres flow)."""
    traces = []
    operations = [
        ("api-gateway", "HTTP GET /api/v1/incidents", None),
        ("api-gateway", "HTTP POST /api/v1/incidents", None),
        ("auth-service", "validate_token", "api-gateway"),
        ("auth-service", "get_user", "api-gateway"),
        ("incident-service", "list_incidents", "api-gateway"),
        ("incident-service", "create_incident", "api-gateway"),
        ("postgres", "SELECT * FROM incidents", "incident-service"),
        ("postgres", "INSERT INTO incidents", "incident-service"),
        ("ai-service", "generate_hypotheses", "incident-service"),
        ("redis", "GET session", "auth-service"),
    ]

    base_time = datetime.utcnow() - timedelta(hours=6)
    for i in range(25):
        trace_id = str(uuid.uuid4())
        trace_start = base_time + timedelta(minutes=i * 15 + random.randint(0, 10))
        total_duration = 0

        # Build span chain
        chain = [
            operations[0],
            random.choice(operations[1:4]),
            random.choice(operations[4:7]),
        ]
        if random.random() > 0.5:
            chain.append(operations[8])

        spans = []
        parent_span_id = None
        for j, (svc, op, _) in enumerate(chain):
            duration = random.gauss(30 + j * 15, 10)
            duration = max(5, min(200, duration))
            total_duration += duration
            span_id = str(uuid.uuid4())
            spans.append({
                "trace_id": trace_id,
                "span_id": span_id,
                "parent_span_id": parent_span_id,
                "service_name": svc,
                "operation": op,
                "duration_ms": round(duration, 2),
                "status": "ok" if random.random() > 0.02 else "error",
                "attributes": {"component": "http"},
                "events": [],
                "timestamp": (trace_start + timedelta(milliseconds=total_duration - duration)).isoformat() + "Z",
            })
            parent_span_id = span_id

        traces.append({"trace_id": trace_id, "spans": spans})
    return traces


def generate_demo_errors() -> list[dict[str, Any]]:
    """Generate 15+ error groups with occurrences."""
    error_templates = [
        ("ConnectionTimeout", "Connection to database timed out after 30s"),
        ("ConnectionTimeout", "Connection to redis timed out"),
        ("ValidationError", "Invalid email format"),
        ("ValidationError", "Missing required field: project_id"),
        ("AuthenticationError", "Invalid or expired token"),
        ("AuthenticationError", "User not found"),
        ("DatabaseError", "Deadlock detected"),
        ("DatabaseError", "Too many connections"),
        ("ExternalServiceError", "Downstream service unavailable"),
        ("ExternalServiceError", "Rate limit exceeded"),
        ("ResourceNotFound", "Incident not found"),
        ("ResourceNotFound", "Project not found"),
        ("InternalServerError", "Unexpected null pointer"),
        ("InternalServerError", "Out of memory"),
        ("IntegrityError", "Duplicate key violation"),
    ]

    groups = []
    base_time = datetime.utcnow() - timedelta(days=7)
    for error_class, message in error_templates:
        fingerprint = f"{random.choice(SERVICES)}|{error_class}|{message[:50]}"
        count = random.randint(1, 50)
        occurrences = []
        for _ in range(count):
            ts = base_time + timedelta(
                hours=random.randint(0, 168),
                minutes=random.randint(0, 60)
            )
            occurrences.append({
                "timestamp": ts.isoformat() + "Z",
                "service_name": fingerprint.split("|")[0],
                "stack_trace": f"  File \"app/api/endpoint.py\", line 42\n    raise {error_class}(message)",
            })
        occurrences.sort(key=lambda x: x["timestamp"], reverse=True)
        groups.append({
            "fingerprint": fingerprint,
            "service_name": fingerprint.split("|")[0],
            "error_class": error_class,
            "message": message,
            "occurrence_count": count,
            "first_seen": occurrences[-1]["timestamp"],
            "last_seen": occurrences[0]["timestamp"],
            "occurrences": occurrences[:20],
            "status": random.choice(["unresolved", "investigating", "resolved", "ignored"]),
            "assignee": None,
            "notes": None,
        })
    return groups


def generate_demo_hosts() -> list[dict[str, Any]]:
    """Generate 3-5 hosts with metrics."""
    hostnames = ["sre-prod-01", "sre-prod-02", "sre-prod-03", "sre-staging-01", "sre-dev-01"]
    hosts = []
    base_time = datetime.utcnow() - timedelta(hours=2)

    for hostname in hostnames[:4]:
        metrics_history = []
        for i in range(12):
            ts = base_time + timedelta(minutes=i * 10)
            metrics_history.append({
                "timestamp": ts.isoformat() + "Z",
                "cpu_percent": round(random.uniform(15, 85), 1),
                "memory_percent": round(random.uniform(40, 90), 1),
                "disk_usage": round(random.uniform(50, 95), 1),
                "network_io": {"bytes_sent": random.randint(1000, 100000), "bytes_recv": random.randint(1000, 100000)},
            })
        hosts.append({
            "hostname": hostname,
            "latest_metrics": metrics_history[-1] if metrics_history else {},
            "metrics_history": metrics_history,
            "processes": [
                {"pid": 1000 + i, "name": n, "cpu_percent": round(random.uniform(0, 5), 1), "memory_percent": round(random.uniform(0.1, 2), 1)}
                for i, n in enumerate(["uvicorn", "postgres", "redis-server", "nginx", "node"])
            ],
            "containers": [
                {"id": f"abc{i}", "name": s, "state": "running"}
                for i, s in enumerate(SERVICES[:4])
            ],
        })
    return hosts


def generate_demo_deployments() -> list[dict[str, Any]]:
    """Generate 10+ recent deployments."""
    deployments = []
    base_time = datetime.utcnow() - timedelta(days=14)
    commits = [f"a1b2c3{i}d" for i in range(20)]

    for i in range(12):
        service = random.choice(SERVICES)
        deployments.append({
            "deployment_id": str(uuid.uuid4()),
            "service": service,
            "version": f"1.{random.randint(0, 5)}.{random.randint(0, 20)}",
            "commit_sha": random.choice(commits),
            "description": f"Deploy {service} - bug fixes and improvements",
            "deployed_by": random.choice(["ci-pipeline", "deploy-bot", "ops-team"]),
            "timestamp": (base_time + timedelta(days=i, hours=random.randint(0, 12))).isoformat() + "Z",
        })
    deployments.sort(key=lambda x: x["timestamp"], reverse=True)
    return deployments


def generate_demo_slos() -> list[dict[str, Any]]:
    """Generate 5 SLOs for key services."""
    slos = [
        {"name": "API Availability", "service_name": "api-gateway", "sli_type": "availability", "target_percentage": 99.9, "time_window_days": 30, "description": "API Gateway uptime"},
        {"name": "Auth Latency P95", "service_name": "auth-service", "sli_type": "latency", "target_percentage": 99.0, "time_window_days": 30, "description": "95th percentile response time under 200ms"},
        {"name": "Incident API Latency", "service_name": "incident-service", "sli_type": "latency", "target_percentage": 99.5, "time_window_days": 30, "description": "Incident API P99 under 500ms"},
        {"name": "AI Service Availability", "service_name": "ai-service", "sli_type": "availability", "target_percentage": 99.5, "time_window_days": 30, "description": "AI hypothesis generation availability"},
        {"name": "WebSocket Connectivity", "service_name": "websocket-service", "sli_type": "availability", "target_percentage": 99.9, "time_window_days": 30, "description": "WebSocket connection success rate"},
    ]
    result = []
    for i, s in enumerate(slos):
        compliance = round(random.uniform(98.5, 100), 2)
        error_budget = max(0, (s["target_percentage"] / 100) - (compliance / 100))
        result.append({
            "slo_id": str(uuid.uuid4()),
            **s,
            "current_compliance": compliance,
            "error_budget_remaining": round(error_budget * 100, 2),
            "burn_rate": round(random.uniform(0.5, 2.0), 2),
        })
    return result


def generate_demo_monitors() -> list[dict[str, Any]]:
    """Generate 5 synthetic monitors."""
    monitors = [
        {"name": "API Health Check", "type": "api", "url": "http://api-gateway:8500/health", "frequency_seconds": 60, "assertions": ["status_code == 200"], "enabled": True},
        {"name": "Auth Service Ping", "type": "api", "url": "http://auth-service:8501/health", "frequency_seconds": 120, "assertions": ["status_code == 200", "response_time < 500"], "enabled": True},
        {"name": "Incident API Check", "type": "api", "url": "http://incident-service:8502/health", "frequency_seconds": 60, "assertions": ["status_code == 200"], "enabled": True},
        {"name": "Frontend Ping", "type": "ping", "url": "https://sre-copilot.pages.dev", "frequency_seconds": 300, "assertions": ["reachable"], "enabled": True},
        {"name": "WebSocket Connect", "type": "api", "url": "ws://websocket-service:8505/ws", "frequency_seconds": 180, "assertions": ["connection_ok"], "enabled": True},
    ]
    result = []
    base_time = datetime.utcnow() - timedelta(hours=1)
    for i, m in enumerate(monitors):
        results_history = []
        for j in range(10):
            ts = base_time + timedelta(minutes=j * 6)
            success = random.random() > 0.05
            results_history.append({
                "timestamp": ts.isoformat() + "Z",
                "success": success,
                "response_time_ms": random.randint(20, 150) if success else None,
                "status_code": 200 if success else 500,
            })
        result.append({
            "monitor_id": str(uuid.uuid4()),
            **m,
            "results_history": results_history,
            "last_check": results_history[-1]["timestamp"] if results_history else None,
            "last_status": "up" if results_history and results_history[-1]["success"] else "down",
        })
    return result


def generate_demo_browser_data() -> list:
    """Generate demo browser monitoring data."""
    data = []
    urls = [
        "https://app.example.com/dashboard",
        "https://app.example.com/incidents",
        "https://app.example.com/settings",
        "https://app.example.com/apm",
        "https://app.example.com/logs",
    ]

    now = datetime.utcnow()
    for i in range(100):
        ts = (now - timedelta(minutes=random.randint(1, 1440))).isoformat() + "Z"
        url = random.choice(urls)

        web_vitals = [
            {"name": "LCP", "value": round(random.uniform(1.0, 4.0), 2) * 1000, "rating": random.choice(["good", "needs-improvement", "poor"])},
            {"name": "FID", "value": round(random.uniform(10, 300), 1), "rating": random.choice(["good", "needs-improvement", "poor"])},
            {"name": "CLS", "value": round(random.uniform(0, 0.3), 3), "rating": random.choice(["good", "needs-improvement", "poor"])},
            {"name": "FCP", "value": round(random.uniform(0.5, 3.0), 2) * 1000, "rating": random.choice(["good", "needs-improvement"])},
            {"name": "TTFB", "value": round(random.uniform(50, 800), 1), "rating": random.choice(["good", "needs-improvement", "poor"])},
        ]

        errors = []
        if random.random() < 0.15:
            errors.append({
                "message": random.choice([
                    "Uncaught TypeError: Cannot read property 'map' of undefined",
                    "Uncaught ReferenceError: process is not defined",
                    "Unhandled Promise Rejection: Network Error",
                    "ChunkLoadError: Loading chunk 5 failed",
                    "SyntaxError: Unexpected token < in JSON",
                ]),
                "filename": random.choice(["main.js", "vendor.js", "app.js"]),
                "lineno": random.randint(1, 5000),
                "colno": random.randint(1, 200),
                "type": random.choice(["error", "unhandledrejection"]),
            })

        page_load = {
            "dom_content_loaded": round(random.uniform(200, 2000), 1),
            "load_complete": round(random.uniform(500, 5000), 1),
            "first_paint": round(random.uniform(100, 1500), 1),
            "first_contentful_paint": round(random.uniform(200, 2500), 1),
        }

        xhr_events = []
        for _ in range(random.randint(1, 5)):
            xhr_events.append({
                "url": random.choice(["/api/v1/incidents", "/api/v1/auth/me", "/api/v1/metrics/services", "/api/v1/logs/search"]),
                "method": random.choice(["GET", "POST"]),
                "duration_ms": round(random.uniform(10, 500), 1),
                "status": random.choice([200, 200, 200, 200, 500, 404]),
                "success": random.random() > 0.1,
            })

        data.append({
            "timestamp": ts,
            "app_name": "sre-copilot-frontend",
            "url": url,
            "web_vitals": web_vitals,
            "errors": errors,
            "page_load": page_load,
            "xhr_events": xhr_events,
        })

    return data
