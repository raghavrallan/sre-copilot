"""
SRE Copilot Infrastructure Agent - Collects host metrics and sends to metrics-collector.
"""
import json
import logging
import os
import signal
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Load .env from agent directory
_load_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_load_path)

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)

# Configuration from env
COLLECTOR_URL = os.getenv("COLLECTOR_URL", "http://localhost:8001")
HOSTNAME_OVERRIDE = os.getenv("HOSTNAME_OVERRIDE", "")
COLLECT_INTERVAL = int(os.getenv("COLLECT_INTERVAL", "15"))
COLLECT_DOCKER = os.getenv("COLLECT_DOCKER", "true").lower() in ("true", "1", "yes")

_running = True


def _handle_shutdown(signum, frame):
    """Handle SIGINT/SIGTERM for graceful shutdown."""
    global _running
    logger.info("Received shutdown signal %s, stopping...", signum)
    _running = False


def _get_hostname() -> str:
    """Get hostname, with optional override."""
    if HOSTNAME_OVERRIDE:
        return HOSTNAME_OVERRIDE
    try:
        import socket
        return socket.gethostname()
    except Exception:
        return "unknown"


def _collect_docker_containers() -> list:
    """Collect Docker container metrics via Docker socket."""
    import subprocess

    containers = []
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.ID}}|{{.Names}}|{{.Status}}"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return containers
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split("|", 2)
            if len(parts) >= 3:
                containers.append({"id": parts[0], "name": parts[1], "state": parts[2].lower()})
            elif len(parts) == 2:
                containers.append({"id": parts[0], "name": parts[1], "state": "running"})
    except FileNotFoundError:
        logger.debug("Docker not found, skipping container metrics")
    except subprocess.TimeoutExpired:
        logger.warning("Docker ps timed out")
    except Exception as e:
        logger.debug("Docker collection failed: %s", e)
    return containers


def _collect_metrics() -> dict:
    """Collect host metrics using psutil."""
    import psutil

    cpu_percent = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    memory_percent = mem.percent

    disk_usage = 0.0
    try:
        disk = psutil.disk_usage("/")
        disk_usage = disk.percent
    except Exception:
        pass

    network_io = {"bytes_sent": 0, "bytes_recv": 0}
    try:
        net = psutil.net_io_counters()
        network_io = {"bytes_sent": net.bytes_sent, "bytes_recv": net.bytes_recv}
    except Exception:
        pass

    processes = []
    try:
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                pinfo = p.info
                processes.append({
                    "pid": pinfo.get("pid"),
                    "name": pinfo.get("name", "?"),
                    "cpu_percent": pinfo.get("cpu_percent") or 0,
                    "memory_percent": pinfo.get("memory_percent") or 0,
                })
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        # Sort by CPU and take top 20
        processes.sort(key=lambda x: x.get("cpu_percent") or 0, reverse=True)
        processes = processes[:20]
    except Exception as e:
        logger.warning("Process list collection failed: %s", e)

    load_avg = [0.0, 0.0, 0.0]
    try:
        load_avg = list(psutil.getloadavg()) if hasattr(psutil, "getloadavg") else [0.0, 0.0, 0.0]
    except Exception:
        try:
            import os
            load_avg = os.getloadavg()  # type: ignore
        except Exception:
            pass

    containers = []

    if COLLECT_DOCKER:
        containers = _collect_docker_containers()

    return {
        "hostname": _get_hostname(),
        "cpu_percent": cpu_percent,
        "memory_percent": memory_percent,
        "disk_usage": disk_usage,
        "network_io": network_io,
        "processes": processes,
        "containers": containers,
        "load_avg": load_avg,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }


def _send_metrics(metrics: dict) -> bool:
    """Send metrics to metrics-collector-service."""
    url = f"{COLLECTOR_URL.rstrip('/')}/infrastructure/ingest"
    payload = {
        "hostname": metrics["hostname"],
        "cpu_percent": metrics["cpu_percent"],
        "memory_percent": metrics["memory_percent"],
        "disk_usage": metrics["disk_usage"],
        "network_io": metrics["network_io"],
        "processes": metrics["processes"],
        "containers": metrics["containers"],
        "timestamp": metrics["timestamp"],
    }
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            logger.debug("Sent metrics for %s", metrics["hostname"])
            return True
    except httpx.HTTPStatusError as e:
        logger.error("HTTP error sending metrics: %s %s", e.response.status_code, e.response.text)
        return False
    except Exception as e:
        logger.error("Failed to send metrics: %s", e)
        return False


def run():
    """Main loop: collect and send metrics every COLLECT_INTERVAL seconds."""
    global _running
    logger.info(
        "Starting agent: collector=%s hostname=%s interval=%ds docker=%s",
        COLLECTOR_URL,
        _get_hostname(),
        COLLECT_INTERVAL,
        COLLECT_DOCKER,
    )
    signal.signal(signal.SIGINT, _handle_shutdown)
    signal.signal(signal.SIGTERM, _handle_shutdown)
    while _running:
        try:
            metrics = _collect_metrics()
            _send_metrics(metrics)
        except Exception as e:
            logger.exception("Collection/send error: %s", e)
        # Sleep in small chunks to allow quick shutdown
        for _ in range(COLLECT_INTERVAL):
            if not _running:
                break
            time.sleep(1)
    logger.info("Agent stopped")


if __name__ == "__main__":
    run()
