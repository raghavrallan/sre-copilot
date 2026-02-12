# SRE Copilot Infrastructure Agent

Lightweight Python agent that collects host metrics and sends them to the SRE Copilot metrics-collector-service.

## Features

- **Host metrics**: CPU %, memory %, disk usage, network I/O
- **Process list**: Top 20 processes by CPU usage
- **Load average**: 1, 5, 15 minute load (on supported platforms)
- **Docker containers**: Optional container metrics via Docker socket
- Configurable collection interval and destination URL
- Graceful shutdown on SIGINT/SIGTERM

## Installation

```bash
cd agent/infra-agent
pip install -r requirements.txt
```

## Configuration

Configure via environment variables or a `.env` file in the agent directory:

| Variable | Default | Description |
|----------|---------|-------------|
| `COLLECTOR_URL` | `http://localhost:8001` | Base URL of the metrics-collector-service |
| `HOSTNAME_OVERRIDE` | *(system hostname)* | Override hostname for this agent |
| `COLLECT_INTERVAL` | `15` | Seconds between metric collection cycles |
| `COLLECT_DOCKER` | `true` | Set to `false` to skip Docker container collection |

## Usage

Run the agent:

```bash
python agent.py
```

Or as a module:

```bash
python -m agent
```

To run with custom settings:

```bash
COLLECTOR_URL=http://metrics-collector:8001 COLLECT_INTERVAL=30 python agent.py
```

## Docker

The agent can run in a container. Ensure the Docker socket is mounted if you want container metrics:

```bash
docker run -v /var/run/docker.sock:/var/run/docker.sock \
  -e COLLECTOR_URL=http://host.docker.internal:8001 \
  your-image python agent.py
```

## Metrics Endpoint

Metrics are sent via `POST /infrastructure/ingest` to the metrics-collector-service. The payload matches the `HostMetrics` schema expected by that service.
