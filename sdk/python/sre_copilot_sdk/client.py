"""SRE Copilot SDK Client - Batches and sends metrics to the metrics-collector-service."""
import asyncio
import logging
import time
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class MetricPoint:
    """Single metric data point."""

    service_name: str
    metric_name: str
    value: float
    metric_type: str = "gauge"
    tags: Dict[str, Any] = None
    timestamp: Optional[str] = None


class SRECopilotClient:
    """Client that batches and sends metrics to the metrics-collector-service."""

    def __init__(
        self,
        collector_url: str = "http://localhost:8580/api/v1/ingest",
        service_name: str = "unknown",
        flush_interval: float = 10.0,
        batch_size: int = 100,
        api_key: str = "",
    ) -> None:
        self.collector_url = collector_url.rstrip("/")
        self.service_name = service_name
        self.api_key = api_key
        self.flush_interval = flush_interval
        self.batch_size = batch_size
        self._buffer: List[Dict[str, Any]] = []
        self._running = False
        self._task: Optional[asyncio.Task[None]] = None

    async def start(self) -> None:
        """Start the flush loop."""
        self._running = True
        self._task = asyncio.create_task(self._flush_loop())
        logger.info("SRE Copilot SDK started for service: %s", self.service_name)

    async def stop(self) -> None:
        """Stop the flush loop and flush remaining metrics."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self._flush()
        logger.info("SRE Copilot SDK stopped")

    def record_metric(
        self,
        metric_name: str,
        value: float,
        metric_type: str = "gauge",
        tags: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record a custom metric."""
        self._buffer.append(
            {
                "service_name": self.service_name,
                "metric_name": metric_name,
                "value": value,
                "metric_type": metric_type,
                "tags": tags or {},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        if len(self._buffer) >= self.batch_size:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._flush())
            except RuntimeError:
                pass

    def record_transaction(
        self,
        endpoint: str,
        method: str,
        status_code: int,
        duration_ms: float,
        db_duration_ms: float = 0,
        external_duration_ms: float = 0,
        error: Optional[str] = None,
    ) -> None:
        """Record an HTTP transaction."""
        self._buffer.append(
            {
                "service_name": self.service_name,
                "metric_name": "http.request",
                "value": duration_ms,
                "metric_type": "histogram",
                "tags": {
                    "transaction_id": str(uuid.uuid4()),
                    "endpoint": endpoint,
                    "method": method,
                    "status_code": status_code,
                    "db_duration_ms": db_duration_ms,
                    "external_duration_ms": external_duration_ms,
                    "error": error or "",
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        if len(self._buffer) >= self.batch_size:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._flush())
            except RuntimeError:
                pass

    def record_error(
        self,
        error_class: str,
        message: str,
        stack_trace: str = "",
        attributes: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Record an error event (batched and sent via _flush)."""
        self._buffer.append(
            {
                "service_name": self.service_name,
                "metric_name": "error",
                "value": 1.0,
                "metric_type": "counter",
                "tags": {
                    "error_class": error_class,
                    "message": message,
                    "stack_trace": stack_trace[:500] if stack_trace else "",
                    **(attributes or {}),
                },
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        if len(self._buffer) >= self.batch_size:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._flush())
            except RuntimeError:
                pass

    async def _flush_loop(self) -> None:
        """Periodically flush buffered metrics."""
        while self._running:
            await asyncio.sleep(self.flush_interval)
            await self._flush()

    async def _flush(self) -> None:
        """Send buffered metrics to the collector."""
        if not self._buffer:
            return
        batch = self._buffer[: self.batch_size]
        self._buffer = self._buffer[self.batch_size :]
        headers = {}
        if self.api_key:
            headers["X-API-Key"] = self.api_key
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                await client.post(
                    f"{self.collector_url}/metrics", json={"metrics": batch}, headers=headers
                )
        except Exception as e:
            logger.warning("Failed to flush metrics: %s", e)
            self._buffer = batch + self._buffer
