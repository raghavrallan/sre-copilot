# SRE Copilot - Complete System Architecture
## Full Stack Architecture with Detailed Ingestion Layer

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              USER INTERFACE LAYER                                    │
│                                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ Slack Bot    │  │ Teams Bot    │  │ Web Dashboard│  │ Mobile App   │          │
│  │              │  │              │  │ (React/TS)   │  │ (Phase 2+)   │          │
│  │ - Commands   │  │ - Commands   │  │ - Incidents  │  │ - Alerts     │          │
│  │ - Alerts     │  │ - Alerts     │  │ - Metrics    │  │ - Status     │          │
│  │ - Feedback   │  │ - Feedback   │  │ - Analytics  │  │              │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │                   │
└─────────┼──────────────────┼──────────────────┼──────────────────┼───────────────────┘
          │                  │                  │                  │
          └──────────────────┴──────────────────┴──────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                            API GATEWAY & AUTH LAYER                                  │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ FastAPI Gateway                                                            │    │
│  │ - Azure AD SSO Integration                                                 │    │
│  │ - RBAC (Role-Based Access Control)                                         │    │
│  │ - Rate Limiting (per tenant, per user)                                     │    │
│  │ - Audit Logging (all API calls logged)                                     │    │
│  │ - Multi-tenant Context Injection                                           │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                          ╔═══════════════════════════════╗                          │
│                          ║   INGESTION LAYER (CORE)      ║                          │
│                          ╚═══════════════════════════════╝                          │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐  │
│  │                        SIGNAL COLLECTORS (Multi-Protocol)                    │  │
│  │                                                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │ Webhook     │  │ Pull-Based  │  │ Stream      │  │ Push-Based  │       │  │
│  │  │ Receiver    │  │ Poller      │  │ Consumer    │  │ Agent       │       │  │
│  │  │             │  │             │  │             │  │             │       │  │
│  │  │ - PagerDuty │  │ - Prometheus│  │ - Kafka     │  │ - Custom    │       │  │
│  │  │ - Datadog   │  │ - Grafana   │  │ - Kinesis   │  │   Exporters │       │  │
│  │  │ - Opsgenie  │  │ - Azure Mon │  │ - PubSub    │  │             │       │  │
│  │  │ - Generic   │  │ - CloudWatch│  │             │  │             │       │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘       │  │
│  │         │                 │                 │                 │              │  │
│  │         └─────────────────┴─────────────────┴─────────────────┘              │  │
│  │                                   │                                          │  │
│  │                         ┌─────────▼─────────┐                                │  │
│  │                         │ Protocol Adapters │                                │  │
│  │                         │ - JSON normalizer │                                │  │
│  │                         │ - PromQL parser   │                                │  │
│  │                         │ - Log parser      │                                │  │
│  │                         │ - Metric converter│                                │  │
│  │                         └─────────┬─────────┘                                │  │
│  └───────────────────────────────────┼──────────────────────────────────────────┘  │
│                                      │                                             │
│  ┌───────────────────────────────────▼──────────────────────────────────────────┐  │
│  │                        SIGNAL NORMALIZATION ENGINE                           │  │
│  │                                                                              │  │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐          │  │
│  │  │ Schema Validator │  │ Deduplicator     │  │ Enricher         │          │  │
│  │  │ - Type checking  │  │ - Hash-based     │  │ - Add metadata   │          │  │
│  │  │ - Required fields│  │ - Time window    │  │ - Add topology   │          │  │
│  │  │ - Data cleaning  │  │ - Source tracking│  │ - Add labels     │          │  │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘          │  │
│  │                                                                              │  │
│  └───────────────────────────────────┬──────────────────────────────────────────┘  │
│                                      │                                             │
│  ┌───────────────────────────────────▼──────────────────────────────────────────┐  │
│  │                          SIGNAL CLASSIFICATION                               │  │
│  │                                                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │  │
│  │  │ Alert       │  │ Metric      │  │ Log Event   │  │ Trace Event │        │  │
│  │  │ Classifier  │  │ Deviation   │  │ Pattern     │  │ Anomaly     │        │  │
│  │  │             │  │ Detector    │  │ Matcher     │  │ Detector    │        │  │
│  │  │ - Critical  │  │ - Threshold │  │ - Error     │  │ - Latency   │        │  │
│  │  │ - Warning   │  │ - Anomaly   │  │ - Stack     │  │ - Failures  │        │  │
│  │  │ - Info      │  │ - Trend     │  │   trace     │  │             │        │  │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │  │
│  │         │                 │                 │                 │               │  │
│  │         └─────────────────┴─────────────────┴─────────────────┘               │  │
│  │                                   │                                           │  │
│  └───────────────────────────────────┼───────────────────────────────────────────┘  │
│                                      │                                             │
│  ┌───────────────────────────────────▼──────────────────────────────────────────┐  │
│  │                           SIGNAL ROUTING & QUEUEING                          │  │
│  │                                                                              │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐   │  │
│  │  │ Redis Queue (Bull)                                                   │   │  │
│  │  │                                                                      │   │  │
│  │  │  Priority Queues:                                                    │   │  │
│  │  │  - Critical alerts (P0)    → Context Assembly (immediate)           │   │  │
│  │  │  - Warning alerts (P1)     → Context Assembly (1min delay)          │   │  │
│  │  │  - Metrics/Logs (P2)       → Batch Processing (5min window)         │   │  │
│  │  │  - Background tasks (P3)   → Analysis (15min window)                │   │  │
│  │  │                                                                      │   │  │
│  │  │  Dead Letter Queue:                                                  │   │  │
│  │  │  - Failed processing → Manual review                                │   │  │
│  │  │  - Invalid signals → Schema evolution                               │   │  │
│  │  └──────────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                              │  │
│  └───────────────────────────────────┬──────────────────────────────────────────┘  │
│                                      │                                             │
│  ┌───────────────────────────────────▼──────────────────────────────────────────┐  │
│  │                         INGESTION METRICS & MONITORING                       │  │
│  │                                                                              │  │
│  │  - Signals per second (by source, by type)                                  │  │
│  │  - Processing latency (p50, p95, p99)                                       │  │
│  │  - Queue depth and wait times                                               │  │
│  │  - Error rates (validation, parsing, routing)                               │  │
│  │  - Deduplication ratio                                                      │  │
│  │  - Integration health checks                                                │  │
│  │                                                                              │  │
│  └──────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                    DETERMINISTIC REASONING ENGINE (Primary Brain)                    │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ CONTEXT ASSEMBLY ENGINE                                                    │    │
│  │                                                                            │    │
│  │  Signal arrives → Triggers context snapshot generation:                   │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Context Snapshot Builder (Immutable State Capture)               │     │    │
│  │  │                                                                  │     │    │
│  │  │ 1. Service Topology                                             │     │    │
│  │  │    - Service mesh graph (upstream/downstream dependencies)      │     │    │
│  │  │    - Current deployment versions                                │     │    │
│  │  │    - Replica counts and health                                  │     │    │
│  │  │                                                                  │     │    │
│  │  │ 2. Recent Changes (T-24h)                                       │     │    │
│  │  │    - Deployments (with commit hashes)                           │     │    │
│  │  │    - Config changes                                             │     │    │
│  │  │    - Infrastructure modifications                               │     │    │
│  │  │    - Dependency updates                                         │     │    │
│  │  │                                                                  │     │    │
│  │  │ 3. Traffic Baseline                                             │     │    │
│  │  │    - Requests per second (7-day moving average)                 │     │    │
│  │  │    - Error rate baseline                                        │     │    │
│  │  │    - Latency percentiles (p50, p95, p99)                        │     │    │
│  │  │                                                                  │     │    │
│  │  │ 4. Dependency Health                                            │     │    │
│  │  │    - Database connection pools                                  │     │    │
│  │  │    - External API response times                                │     │    │
│  │  │    - Cache hit rates                                            │     │    │
│  │  │    - Message queue depths                                       │     │    │
│  │  │                                                                  │     │    │
│  │  │ 5. SLO State                                                    │     │    │
│  │  │    - Current error budget burn rate                             │     │    │
│  │  │    - SLO compliance status                                      │     │    │
│  │  │    - Time to SLO breach (if trending)                           │     │    │
│  │  │                                                                  │     │    │
│  │  │ 6. Correlated Signals                                           │     │    │
│  │  │    - Other alerts in same time window                           │     │    │
│  │  │    - Metric deviations across service graph                     │     │    │
│  │  │    - Log patterns (errors, warnings)                            │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ INCIDENT STATE MACHINE                                                     │    │
│  │                                                                            │    │
│  │  States: DETECTED → ACKNOWLEDGED → INVESTIGATING → MITIGATED →            │    │
│  │          RESOLVED → LEARNED                                                │    │
│  │  Alt:    DETECTED → ... → INCONCLUSIVE → LEARNED                          │    │
│  │                                                                            │    │
│  │  All state transitions:                                                    │    │
│  │  - Logged with timestamp + context                                        │    │
│  │  - Trigger downstream workflows                                           │    │
│  │  - Update metrics (MTTR, MTTA, etc.)                                      │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ EVIDENCE AGGREGATOR                                                        │    │
│  │                                                                            │    │
│  │  For each signal:                                                          │    │
│  │  - Gather temporal correlations (what changed around this time?)           │    │
│  │  - Query historical precedents (have we seen this pattern?)                │    │
│  │  - Assess signal strength (how severe is the deviation?)                   │    │
│  │  - Map to service dependencies (what could cause this?)                    │    │
│  │                                                                            │    │
│  │  Output: Structured evidence package                                       │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
└───────────────────────────────────────┼────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│                     LLM REASONING ASSISTANT (Supporting Role)                       │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ Claude API Integration (with Prompt Caching)                               │    │
│  │                                                                            │    │
│  │  Use Cases:                                                                │    │
│  │  1. Hypothesis Generation                                                  │    │
│  │     Input: Context snapshot + evidence package                             │    │
│  │     Output: 5-10 hypothesis candidates with reasoning                      │    │
│  │                                                                            │    │
│  │  2. Evidence Summarization                                                 │    │
│  │     Input: Raw logs, metrics, traces                                       │    │
│  │     Output: Human-readable summary of key observations                     │    │
│  │                                                                            │    │
│  │  3. Decision Explanation                                                   │    │
│  │     Input: Selected hypothesis + evidence                                  │    │
│  │     Output: Prose explanation for humans                                   │    │
│  │                                                                            │    │
│  │  4. Natural Language Translation                                           │    │
│  │     Input: "What's wrong with payment-api?"                                │    │
│  │     Output: Structured query → Execute → Summarize results                 │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Prompt Caching Strategy:                                         │     │    │
│  │  │ - Context snapshots (cached 5min)                                │     │    │
│  │  │ - Runbook corpus (cached 1hr)                                    │     │    │
│  │  │ - Historical incident summaries (cached 1hr)                     │     │    │
│  │  │ - System topology (cached 15min)                                 │     │    │
│  │  │                                                                  │     │    │
│  │  │ Cost optimization: ~70% token reduction via caching              │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
└───────────────────────────────────────┼────────────────────────────────────────────┘
                                        │
┌───────────────────────────────────────▼────────────────────────────────────────────┐
│              DETERMINISTIC REASONING ENGINE (Continued - Scoring & Selection)       │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ HYPOTHESIS CONFIDENCE SCORING (Multi-Factor Model)                         │    │
│  │                                                                            │    │
│  │  For each hypothesis candidate from LLM:                                   │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Factor 1: Signal Strength (0.25 weight)                          │     │    │
│  │  │ - 3+ sigma deviation → 0.9                                       │     │    │
│  │  │ - 2 sigma → 0.7                                                  │     │    │
│  │  │ - 1 sigma → 0.4                                                  │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Factor 2: Temporal Correlation (0.20 weight)                     │     │    │
│  │  │ - Deploy at T, symptom at T+5min → 0.95                          │     │    │
│  │  │ - Recent config change correlation → 0.85                        │     │    │
│  │  │ - No temporal correlation → 0.3                                  │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Factor 3: Precedent Frequency (0.20 weight)                      │     │    │
│  │  │ - 10+ similar incidents → 0.9                                    │     │    │
│  │  │ - 3-9 similar → 0.7                                              │     │    │
│  │  │ - 1-2 similar → 0.5                                              │     │    │
│  │  │ - First time → 0.3                                               │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Factor 4: Evidence Quality (0.20 weight)                         │     │    │
│  │  │ - Multiple independent sources + no contradictions → 0.95        │     │    │
│  │  │ - Single strong source → 0.7                                     │     │    │
│  │  │ - Weak/conflicting evidence → 0.4                                │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Factor 5: Human Validation History (0.15 weight)                 │     │    │
│  │  │ - Accepted 8/10 times historically → 0.8                         │     │    │
│  │  │ - No history → 0.5 (neutral)                                     │     │    │
│  │  │ - Rejected frequently → 0.2                                      │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  Final Confidence = Σ(factor × weight)                                    │    │
│  │  Confidence Range = [base - uncertainty, base + uncertainty]               │    │
│  │                                                                            │    │
│  │  Output: Ranked hypotheses with confidence ranges and component breakdown  │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ POLICY ENGINE                                                              │    │
│  │                                                                            │    │
│  │  Rules:                                                                    │    │
│  │  - Present top 3 hypotheses if confidence > 0.4                            │    │
│  │  - Auto-ack if confidence > 0.85 AND precedent exists                      │    │
│  │  - Mark INCONCLUSIVE if all hypotheses < 0.3                               │    │
│  │  - Request human input if conflicting evidence                             │    │
│  │                                                                            │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ RECOMMENDATION ENGINE                                                      │    │
│  │                                                                            │    │
│  │  For each hypothesis:                                                      │    │
│  │  - Query runbook database (vector similarity search)                       │    │
│  │  - Map to known remediation actions                                        │    │
│  │  - Calculate risk level                                                    │    │
│  │  - Estimate impact (MTTR reduction, blast radius)                          │    │
│  │                                                                            │    │
│  │  Output: Ranked recommendations with risk/benefit analysis                 │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                         DATA & INTELLIGENCE LAYER                                    │
│                                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐      │
│  │ Vector Database      │  │ Time Series DB       │  │ PostgreSQL (Core)    │      │
│  │ (Pinecone)           │  │ (TimescaleDB)        │  │                      │      │
│  │                      │  │                      │  │ Tables:              │      │
│  │ Collections:         │  │ Metrics:             │  │ - tenants            │      │
│  │ - Runbooks           │  │ - Service metrics    │  │ - users              │      │
│  │   (semantic search)  │  │ - Infrastructure     │  │ - incidents          │      │
│  │                      │  │   metrics            │  │ - signals            │      │
│  │ - Incident summaries │  │ - Custom metrics     │  │ - hypotheses         │      │
│  │   (similarity)       │  │                      │  │ - context_snapshots  │      │
│  │                      │  │ Baselines:           │  │ - recommendations    │      │
│  │ - Log patterns       │  │ - Service baselines  │  │ - policies           │      │
│  │   (anomaly detection)│  │ - Anomaly thresholds │  │ - execution_records  │      │
│  │                      │  │ - Forecast models    │  │ - runbooks           │      │
│  │ - Service topology   │  │                      │  │ - integrations       │      │
│  │   (graph embedding)  │  │ Forecasts:           │  │ - audit_logs         │      │
│  │                      │  │ - Trajectories       │  │                      │      │
│  └──────────────────────┘  │ - Impact predictions │  └──────────────────────┘      │
│                            └──────────────────────┘                                 │
│                                                                                      │
│  ┌──────────────────────┐  ┌──────────────────────┐                                │
│  │ Redis (Cache/Queue)  │  │ Elasticsearch        │                                │
│  │                      │  │ (Logs - Optional)    │                                │
│  │ - Session cache      │  │                      │                                │
│  │ - API response cache │  │ - Application logs   │                                │
│  │ - Job queues (Bull)  │  │ - Error traces       │                                │
│  │ - Rate limit counters│  │ - Audit logs         │                                │
│  │ - Feature flags      │  │ - Full-text search   │                                │
│  └──────────────────────┘  └──────────────────────┘                                │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                          MACHINE LEARNING LAYER (Phase 2)                            │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ ANOMALY DETECTION PIPELINE                                                 │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Baseline Model Generation (Nightly)                              │     │    │
│  │  │                                                                  │     │    │
│  │  │ For each service × metric:                                      │     │    │
│  │  │ - 30-day rolling window                                         │     │    │
│  │  │ - Seasonal decomposition (hourly, daily, weekly patterns)       │     │    │
│  │  │ - Statistical baseline (mean, stddev, percentiles)              │     │    │
│  │  │ - Change point detection (known shifts from deploys)            │     │    │
│  │  │                                                                  │     │    │
│  │  │ Stored: Baseline model + confidence bands                       │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  │  ┌──────────────────────────────────────────────────────────────────┐     │    │
│  │  │ Real-Time Anomaly Detection                                      │     │    │
│  │  │                                                                  │     │    │
│  │  │ Algorithm: Isolation Forest + Statistical Outliers               │     │    │
│  │  │                                                                  │     │    │
│  │  │ For each incoming metric:                                       │     │    │
│  │  │ 1. Compare to baseline ± confidence bands                       │     │    │
│  │  │ 2. Calculate anomaly score (0-1)                                │     │    │
│  │  │ 3. Apply 3-gate filter (only alert if all true):                │     │    │
│  │  │    a) Clear baseline exists (>7 days data)                      │     │    │
│  │  │    b) Predictable trajectory (not random walk)                  │     │    │
│  │  │    c) SLO impact potential                                      │     │    │
│  │  │                                                                  │     │    │
│  │  │ Output: Anomaly signal (if gates pass) → Ingestion Layer        │     │    │
│  │  └──────────────────────────────────────────────────────────────────┘     │    │
│  │                                                                            │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ FORECASTING PIPELINE (Prophet)                                             │    │
│  │                                                                            │    │
│  │  Models trained per service × metric:                                      │    │
│  │  - Capacity metrics (disk, memory, connections)                            │    │
│  │  - Traffic trends                                                          │    │
│  │  - Error rate trajectories                                                 │    │
│  │                                                                            │    │
│  │  Forecast horizon: 3h, 6h, 12h, 24h                                        │    │
│  │  Confidence intervals: 80%, 95%                                            │    │
│  │                                                                            │    │
│  │  Alert if: Forecast breaches threshold within forecast window              │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                     INTEGRATION LAYER (Bidirectional)                                │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ INBOUND INTEGRATIONS (Signal Sources)                                      │    │
│  │                                                                            │    │
│  │ Observability:                    Incident Management:                     │    │
│  │ - Prometheus (metrics)            - PagerDuty (alerts)                     │    │
│  │ - Grafana (dashboards)            - Opsgenie (alerts)                      │    │
│  │ - Datadog (metrics/logs/traces)   - VictorOps (alerts)                     │    │
│  │ - New Relic (APM)                                                          │    │
│  │ - Azure Monitor                   Ticketing:                               │    │
│  │ - CloudWatch (AWS)                - Jira (issues)                          │    │
│  │ - GCP Monitoring                  - ServiceNow (incidents)                 │    │
│  │                                   - Linear (issues)                        │    │
│  │ Logs:                                                                      │    │
│  │ - Elasticsearch                   Version Control:                         │    │
│  │ - Loki                            - GitHub (deployments)                   │    │
│  │ - Splunk                          - GitLab (deployments)                   │    │
│  │                                                                            │    │
│  │ Traces:                           CI/CD:                                   │    │
│  │ - Jaeger                          - GitHub Actions                         │    │
│  │ - Zipkin                          - Jenkins                                │    │
│  │ - AWS X-Ray                       - CircleCI                               │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ OUTBOUND INTEGRATIONS (Actions & Notifications)                            │    │
│  │                                                                            │    │
│  │ Chat/Collaboration:               Infrastructure:                          │    │
│  │ - Slack (notifications, bot)      - Kubernetes API (scaling)               │    │
│  │ - Microsoft Teams (bot)           - Terraform (IaC execution)              │    │
│  │ - Discord                         - Ansible (config mgmt)                  │    │
│  │                                                                            │    │
│  │ Cloud Providers:                  Incident Response:                       │    │
│  │ - Azure SDK (resource mgmt)       - PagerDuty (incident updates)           │    │
│  │ - AWS Boto3 (resource mgmt)       - Jira (auto-ticket creation)            │    │
│  │ - GCP Client Libraries            - StatusPage (status updates)            │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────┬───────────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────▼──────────────────────────────────────────────┐
│                        EXECUTION LAYER (Phase 3 - Autonomous Actions)                │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ WORKFLOW ORCHESTRATION (Temporal.io)                                       │    │
│  │                                                                            │    │
│  │  Workflows:                                                                │    │
│  │  - Auto-remediation workflows                                              │    │
│  │  - Approval routing                                                        │    │
│  │  - Rollback orchestration                                                  │    │
│  │  - Multi-step mitigation                                                   │    │
│  │                                                                            │    │
│  │  Features:                                                                 │    │
│  │  - Durable execution (survives crashes)                                    │    │
│  │  - Human-in-the-loop (approval gates)                                      │    │
│  │  - Timeout handling                                                        │    │
│  │  - Compensation logic (undo)                                               │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ ACTION PLAN GENERATOR                                                      │    │
│  │                                                                            │    │
│  │  For each recommendation:                                                  │    │
│  │  - Define action (scale, restart, modify config)                           │    │
│  │  - Set parameters                                                          │    │
│  │  - Check preconditions                                                     │    │
│  │  - Calculate risk (low/medium/high/critical)                               │    │
│  │  - Define rollback strategy                                                │    │
│  │  - Set verification criteria                                               │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ POLICY MATCHER & SAFETY GATES                                              │    │
│  │                                                                            │    │
│  │  Policy Rules:                                                             │    │
│  │  - Match action to policy (environment, service, action type)              │    │
│  │  - Check constraints (time windows, rate limits, risk budgets)             │    │
│  │  - Determine approval requirements                                         │    │
│  │  - Enforce safety gates                                                    │    │
│  │                                                                            │    │
│  │  Safety Gates:                                                             │    │
│  │  - No active incident in same service                                      │    │
│  │  - Deployment age > threshold                                              │    │
│  │  - SLO burn rate within limits                                             │    │
│  │  - Risk budget available                                                   │    │
│  │  - Manual override not active                                              │    │
│  │                                                                            │    │
│  │  Approval Routing:                                                         │    │
│  │  - Auto-execute (low risk, approved policy)                                │    │
│  │  - Notify and wait (medium risk, 5min timeout)                             │    │
│  │  - Require explicit approval (high risk)                                   │    │
│  │  - Block (critical risk or policy violation)                               │    │
│  └────────────────────────────────────┬───────────────────────────────────────┘    │
│                                       │                                            │
│  ┌────────────────────────────────────▼───────────────────────────────────────┐    │
│  │ EXECUTION ENGINE                                                           │    │
│  │                                                                            │    │
│  │  Approved actions are executed via:                                        │    │
│  │  - Terraform (infrastructure changes)                                      │    │
│  │  - Ansible (configuration management)                                      │    │
│  │  - Kubernetes API (scaling, restarts)                                      │    │
│  │  - Cloud provider SDKs (Azure, AWS, GCP)                                   │    │
│  │                                                                            │    │
│  │  All executions:                                                           │    │
│  │  - Logged to audit trail                                                   │    │
│  │  - Verified post-execution                                                 │    │
│  │  - Rolled back on failure                                                  │    │
│  │  - Attributed to approver                                                  │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          CROSS-CUTTING CONCERNS                                      │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ AUDIT & COMPLIANCE                                                         │    │
│  │ - All API calls logged (who, what, when, result)                           │    │
│  │ - All AI decisions logged (hypothesis, evidence, confidence)               │    │
│  │ - All executions logged (action, approver, outcome)                        │    │
│  │ - Immutable audit trail (append-only)                                      │    │
│  │ - SOC2, ISO27001, PCI-DSS compliance ready                                 │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ FEEDBACK LOOP & LEARNING                                                   │    │
│  │                                                                            │    │
│  │ User feedback on:                           Impact:                        │    │
│  │ - Hypothesis acceptance/rejection           - Update confidence weights    │    │
│  │ - Evidence quality ratings                  - Improve LLM prompts          │    │
│  │ - Recommendation usefulness                 - Refine policy rules          │    │
│  │ - Action outcomes                           - Build incident corpus        │    │
│  │                                                                            │    │
│  │ Automated learning:                                                        │    │
│  │ - Incident resolution patterns → Runbook suggestions                       │    │
│  │ - Successful remediations → Policy templates                               │    │
│  │ - False positives → Baseline tuning                                        │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────┐    │
│  │ MONITORING & OBSERVABILITY (Dogfooding)                                    │    │
│  │                                                                            │    │
│  │ System metrics:                             Application metrics:           │    │
│  │ - Ingestion throughput                      - API latency (p50, p95, p99)  │    │
│  │ - Processing latency                        - LLM token usage & cost       │    │
│  │ - Queue depths                              - Cache hit rates              │    │
│  │ - Error rates                               - User engagement              │    │
│  │                                                                            │    │
│  │ Business metrics:                           AI/ML metrics:                 │    │
│  │ - Hypotheses accepted/rejected              - Hypothesis precision/recall  │    │
│  │ - MTTR reduction                            - Prediction accuracy          │    │
│  │ - Alert noise reduction                     - False positive rate          │    │
│  │ - Actions executed/blocked                  - Model drift detection        │    │
│  └────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

## Key Architectural Principles

### 1. **Ingestion Layer Philosophy**
- **Protocol Agnostic**: Support webhooks, polling, streaming, and push
- **Fail-Safe**: Dead letter queues for all failure modes
- **Deduplication**: Hash-based deduplication prevents signal spam
- **Priority-Based**: Critical alerts bypass queue, background tasks batched
- **Observable**: Every step instrumented for debugging

### 2. **Deterministic Core**
- **LLM is Assistant, Not Decision Maker**: All decisions traceable to deterministic logic
- **Confidence is Multi-Factor**: Not just LLM intuition, but evidence-based scoring
- **State Machine Driven**: Explicit incident lifecycle enables metrics & learning
- **Policy-First**: Policies define allowed actions, not ad-hoc decisions

### 3. **Trust & Safety**
- **Graduated Autonomy**: Phase 1 (read-only) → Phase 2 (predict) → Phase 3 (act)
- **Always Explainable**: Show evidence, show reasoning, show confidence breakdown
- **Human Override**: Manual mode, per-service disable, emergency stop
- **Audit Everything**: Immutable audit trail for compliance

### 4. **Data Flow Summary**

```
Signal Sources → Ingestion Layer → Normalization → Classification →
Priority Queue → Context Assembly → Evidence Aggregation →
LLM Hypothesis Generation → Deterministic Confidence Scoring →
Policy Engine → Recommendation → (Phase 3: Execution)
```

### 5. **Scalability Considerations**
- **Multi-Tenant from Day 1**: Tenant isolation at DB and queue level
- **Horizontal Scaling**: Stateless services, queue-based processing
- **Caching Strategy**: Prompt caching (70% token reduction), context caching, API caching
- **Data Retention**: Hot (30d) → Warm (1yr) → Cold (archive) → Delete (3yr)
