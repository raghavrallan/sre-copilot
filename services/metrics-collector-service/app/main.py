"""
SRE Copilot Metrics Collector - APM metrics, traces, and error events
"""
import logging
from fastapi import FastAPI

from app.api import metrics as metrics_api
from app.api import traces as traces_api
from app.api import errors as errors_api
from app.api import infrastructure as infra_api
from app.api import deployments as deploy_api
from app.api import slos as slos_api
from app.api import synthetics as synth_api
from app.api import browser as browser_api
from app.api import dashboards as dashboards_api
from app.services.demo_data import (
    generate_demo_transactions,
    generate_demo_traces,
    generate_demo_errors,
    generate_demo_hosts,
    generate_demo_deployments,
    generate_demo_slos,
    generate_demo_monitors,
)
from app import storage

logger = logging.getLogger(__name__)

app = FastAPI(
    title="SRE Copilot Metrics Collector",
    description="APM metrics, traces, and error events collection service",
    version="1.0.0",
)

# Include routers
app.include_router(metrics_api.router, prefix="/metrics", tags=["Metrics"])
app.include_router(traces_api.router, prefix="/traces", tags=["Traces"])
app.include_router(errors_api.router, prefix="/errors", tags=["Errors"])
app.include_router(infra_api.router, prefix="/infrastructure", tags=["Infrastructure"])
app.include_router(deploy_api.router, prefix="/deployments", tags=["Deployments"])
app.include_router(slos_api.router, prefix="/slos", tags=["SLOs"])
app.include_router(synth_api.router, prefix="/synthetics", tags=["Synthetics"])
app.include_router(browser_api.router, prefix="/browser", tags=["Browser"])
app.include_router(dashboards_api.router, prefix="/dashboards", tags=["Dashboards"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "metrics-collector-service"}


def _seed_demo_data() -> None:
    """Seed demo data if storage is empty."""
    if not storage.transactions:
        storage.transactions.extend(generate_demo_transactions())
        logger.info("Seeded demo transactions: %d", len(storage.transactions))

    if not storage.traces:
        trace_list = generate_demo_traces()
        for t in trace_list:
            storage.traces.append({"trace_id": t["trace_id"], "spans": t["spans"]})
            storage.spans_by_trace[t["trace_id"]] = t["spans"]
        logger.info("Seeded demo traces: %d", len(trace_list))

    if not storage.error_groups:
        for g in generate_demo_errors():
            storage.error_groups[g["fingerprint"]] = g
        logger.info("Seeded demo error groups: %d", len(storage.error_groups))

    if not storage.hosts:
        for h in generate_demo_hosts():
            storage.hosts[h["hostname"]] = h
        logger.info("Seeded demo hosts: %d", len(storage.hosts))

    if not storage.deployments:
        storage.deployments.extend(generate_demo_deployments())
        logger.info("Seeded demo deployments: %d", len(storage.deployments))

    if not storage.slos:
        for s in generate_demo_slos():
            storage.slos[s["slo_id"]] = s
        logger.info("Seeded demo SLOs: %d", len(storage.slos))

    if not storage.monitors:
        for m in generate_demo_monitors():
            storage.monitors[m["monitor_id"]] = m
        logger.info("Seeded demo monitors: %d", len(storage.monitors))


@app.on_event("startup")
async def startup_event():
    """Startup event - seed demo data if storage is empty."""
    logger.info("Metrics Collector Service starting up...")
    _seed_demo_data()


@app.on_event("shutdown")
async def shutdown_event():
    """Shutdown event"""
    logger.info("Metrics Collector Service shutting down...")
