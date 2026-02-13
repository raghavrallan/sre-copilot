"""
Demo data generators for security-service.
Generates 20+ realistic vulnerabilities across services with real-looking CVE IDs.
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
    "metrics-collector-service",
    "synthetic-service",
]

VULN_TEMPLATES = [
    ("CVE-2024-23334", "pydantic", "2.5.3", "2.6.0", "critical", "Improper validation in JSON schema generation allows arbitrary code execution"),
    ("CVE-2024-24762", "fastapi", "0.109.0", "0.115.0", "high", "Path traversal via openapi.json in debug mode"),
    ("CVE-2024-21626", "uvicorn", "0.27.0", "0.30.0", "high", "Arbitrary file read via ASGI scope"),
    ("CVE-2024-34091", "httpx", "0.26.0", "0.27.0", "medium", "Request smuggling when using HTTP/2"),
    ("CVE-2024-35182", "redis", "5.0.1", "5.0.2", "medium", "Authentication bypass in cluster mode"),
    ("CVE-2024-21538", "Django", "4.2.0", "4.2.7", "critical", "SQL injection in QuerySet.select_for_update()"),
    ("CVE-2024-38299", "sqlalchemy", "2.0.23", "2.0.25", "high", "Denial of service via crafted column names"),
    ("CVE-2024-29041", "aiohttp", "3.9.0", "3.9.1", "medium", "Information disclosure in error responses"),
    ("CVE-2024-29841", "certifi", "2023.11.17", "2024.2.2", "low", "Expired root certificates in bundle"),
    ("CVE-2024-38879", "cryptography", "41.0.7", "42.0.0", "high", "Timing oracle in RSA PKCS1v15 decryption"),
    ("CVE-2024-35195", "Jinja2", "3.1.2", "3.1.3", "medium", "Server-side template injection"),
    ("CVE-2024-21931", "requests", "2.31.0", "2.32.0", "low", "Insufficient validation of redirect targets"),
    ("CVE-2024-40582", "PyYAML", "6.0.1", "6.0.2", "critical", "Arbitrary code execution via unsafe_load"),
    ("CVE-2024-38112", "pillow", "10.1.0", "10.2.0", "high", "Buffer overflow in JPEG decoder"),
    ("CVE-2024-29856", "websockets", "12.0", "12.1", "medium", "Resource exhaustion via large frames"),
    ("CVE-2024-38238", "numpy", "1.26.0", "1.26.2", "medium", "Buffer overflow in dtype handling"),
    ("CVE-2024-21539", "psycopg2", "2.9.9", "2.9.10", "low", "Connection string information leakage"),
    ("CVE-2024-38891", "openai", "1.6.0", "1.12.0", "medium", "API key exposure in log messages"),
    ("CVE-2024-35196", "python-dotenv", "1.0.0", "1.0.1", "low", "Path traversal when loading .env from symlinks"),
    ("CVE-2024-21627", "asyncio", "3.11", "3.11.8", "high", "Event loop blocking in SSL context"),
]
DEPENDABOT_TEMPLATES = [
    ("CVE-2024-35183", "lodash", "4.17.21", "4.17.22", "high", "Prototype pollution in merge function"),
    ("CVE-2024-38880", "express", "4.18.2", "4.21.0", "medium", "Open redirect via redirect()"),
    ("CVE-2024-29842", "axios", "1.6.0", "1.7.0", "medium", "SSRF via URL parsing"),
]
TRIVY_TEMPLATES = [
    ("CVE-2024-21626", "alpine", "3.18.2", "3.19.0", "high", "runC container escape"),
    ("CVE-2024-38299", "postgres", "15.4", "15.6", "high", "Privilege escalation in extensions"),
]


def generate_demo_vulnerabilities() -> list[dict[str, Any]]:
    """Generate 20+ realistic vulnerabilities across services."""
    vulns = []
    base_time = datetime.utcnow() - timedelta(days=30)
    all_templates = VULN_TEMPLATES + DEPENDABOT_TEMPLATES + TRIVY_TEMPLATES
    sources = ["pip-audit", "npm-audit", "bandit", "dependabot", "trivy"]
    statuses = ["open", "open", "in_progress", "resolved", "ignored", "false_positive"]

    for i, (cve, pkg, inst_ver, fixed_ver, sev, desc) in enumerate(all_templates[:24]):
        vuln_id = str(uuid.uuid4())
        service = random.choice(SERVICES)
        first_detected = base_time + timedelta(days=random.randint(0, 20))
        last_seen = first_detected + timedelta(days=random.randint(0, 10))
        status = random.choice(statuses)
        source = "pip-audit" if pkg in ["pydantic", "fastapi", "uvicorn", "httpx", "redis", "Django", "sqlalchemy", "aiohttp", "certifi", "cryptography", "Jinja2", "requests", "PyYAML", "pillow", "websockets", "numpy", "psycopg2", "openai", "python-dotenv"] else ("npm-audit" if pkg in ["lodash", "express", "axios"] else "trivy")
        assignee = f"security-{random.randint(1, 5)}@example.com" if status in ["in_progress", "resolved"] else None
        notes = f"Upgrade planned for next sprint" if status == "in_progress" else (f"Fixed in {fixed_ver}" if status == "resolved" else None)

        vulns.append({
            "vuln_id": vuln_id,
            "cve_id": cve,
            "title": f"{pkg} {cve} - {sev.capitalize()}",
            "description": desc,
            "severity": sev,
            "service_name": service,
            "package_name": pkg,
            "installed_version": inst_ver,
            "fixed_version": fixed_ver,
            "source": source,
            "status": status,
            "first_detected": first_detected.isoformat() + "Z",
            "last_seen": last_seen.isoformat() + "Z",
            "assignee": assignee,
            "notes": notes,
        })
    return vulns
