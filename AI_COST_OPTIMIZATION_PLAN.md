# SRE Copilot AI Cost Optimization Plan

**Date:** 2026-01-24
**Problem:** 1000 incidents resulted in 14k+ requests and $23 cost (144+ requests per incident is excessive)
**Goal:** Reduce to <10 requests per incident and <$5 for 1000 incidents

---

## Current State Analysis

### Issue Identification

**Current Metrics (1000 incidents test):**
- Total Requests: 14,000+
- Total Cost: $23
- Requests per Incident: 144+
- AI Calls per Incident: 1 (hypothesis generation only)

**Root Causes:**
1. **No Caching** - Hypotheses regenerated if page refreshed or reopened
2. **No Batching** - Each incident processed individually (1000 separate AI calls)
3. **Large Prompts** - ~500 tokens input + ~1000-2000 tokens output per call
4. **No Token Tracking** - Can't measure actual usage or identify waste
5. **Frontend Over-fetching** - Fetches all 1000 incidents on page load
6. **No Request Deduplication** - Multiple concurrent requests for same incident

### Token Cost Breakdown (GPT-4o-mini)
- **Input:** $0.150 per 1M tokens
- **Output:** $0.600 per 1M tokens
- **Estimated per incident:** ~500 input + ~1500 output = ~2000 tokens/incident
- **1000 incidents:** ~2M tokens = $1.20 (hypothesis only)
- **Actual cost $23** = High frontend API overhead or multiple regenerations

---

## Optimization Strategy

### Phase 1: Immediate Impact (Reduce 70%+ cost)

#### 1. Add Caching Layer [PRIORITY 1]
**Implementation:**
- Check if hypotheses exist in database before calling AI
- Add Redis cache for generated hypotheses (TTL: 24h)
- Implement cache key: `hypothesis:{incident_id}`

**Expected Impact:**
- Reduce duplicate AI calls by 50-90%
- Cost reduction: $10-15 (43-65%)

**Files to modify:**
- `services/incident-service/app/api/incidents.py` - Add DB check before AI call
- `services/ai-service/app/api/ai.py` - Add Redis caching

#### 2. Optimize AI Prompts [PRIORITY 2]
**Implementation:**
- Reduce prompt from ~500 tokens to ~200 tokens
- Reduce max_completion_tokens from 2000 to 800
- Use more concise system prompts
- Remove verbose instructions

**Expected Impact:**
- Reduce token usage by 40-60% per request
- Cost reduction: $5-8 (22-35%)

**Files to modify:**
- `services/ai-service/app/api/ai.py` - Update prompt templates

#### 3. Add Token Usage Tracking [PRIORITY 3]
**Implementation:**
- Create `AIRequest` model to track each AI call
- Store: incident_id, input_tokens, output_tokens, total_cost, timestamp
- Add `/analytics/token-usage` endpoint
- Display metrics in UI

**Expected Impact:**
- Full visibility into costs
- Identify optimization opportunities

**Files to create:**
- `shared/models/ai_request.py` - AIRequest model
- `services/ai-service/app/api/analytics.py` - Analytics endpoints

---

### Phase 2: Advanced Optimizations (Reduce additional 50%+)

#### 4. Implement Batch Processing
**Implementation:**
- Create `/generate-hypotheses-batch` endpoint
- Process 5-10 incidents in single AI call
- Queue incidents in Redis for batch processing
- Process queue every 30 seconds or when 10 incidents accumulated

**Expected Impact:**
- Reduce AI calls by 5-10x
- Cost reduction: Additional 50-80%

**Files to modify:**
- `services/ai-service/app/api/ai.py` - Add batch endpoint
- `services/incident-service/app/services/batch_processor.py` - New file

#### 5. Add Request Deduplication
**Implementation:**
- Use Redis locks to prevent concurrent AI calls for same incident
- Check lock before generating hypotheses
- Lock key: `ai:generating:{incident_id}`, TTL: 60s

**Expected Impact:**
- Prevent duplicate concurrent calls
- Cost reduction: 10-20%

---

### Phase 3: Workflow Enhancement (New Features)

#### 6. Create Pipeline Workflow Tracking
**Implementation:**
- Create `AnalysisStep` model to track each step:
  1. Alert received (Prometheus/Grafana)
  2. Source identification
  3. Platform details fetched
  4. Logs retrieved
  5. AI hypothesis generation
  6. Solution generated
- Track: step_name, status, input_tokens, output_tokens, duration

**Expected Impact:**
- Full visibility into AI pipeline
- Per-step cost breakdown

**Files to create:**
- `shared/models/analysis_step.py` - AnalysisStep model
- `services/ai-service/app/services/workflow.py` - Workflow orchestration

#### 7. Implement Log Retrieval and Analysis
**Implementation:**
- Add log fetching from Prometheus/Grafana/Loki
- Extract relevant log snippets (50 lines max)
- Store with incident for context
- Pass to AI for better analysis

**Expected Impact:**
- Better AI accuracy
- Reduced need for regeneration

**Files to create:**
- `services/integration-service/app/services/log_fetcher.py` - Log fetching
- `shared/models/log_snippet.py` - Log storage

#### 8. Build Workflow Visualization UI
**Implementation:**
- Create `WorkflowTimeline` component
- Show each step with:
  - Status indicator (pending, in_progress, completed, failed)
  - Duration and timestamp
  - Token usage and cost per step
- Add `LogViewer` component with syntax highlighting
- Add `MetricsPanel` for cost breakdown

**Expected Impact:**
- Full transparency for users
- Easy identification of expensive operations

**Files to create:**
- `frontend/src/components/workflow/WorkflowTimeline.tsx`
- `frontend/src/components/workflow/LogViewer.tsx`
- `frontend/src/components/workflow/MetricsPanel.tsx`

#### 9. Add Cost Analytics Dashboard
**Implementation:**
- Create `/analytics` page
- Show:
  - Total AI requests and cost over time (charts)
  - Cost per incident breakdown
  - Token usage trends (input vs output)
  - Most expensive operations
  - Optimization recommendations

**Expected Impact:**
- Ongoing cost monitoring
- Proactive optimization

**Files to create:**
- `frontend/src/pages/AnalyticsPage.tsx`
- `services/ai-service/app/api/analytics.py` - Backend analytics API

---

## Implementation Roadmap

### Week 1: Immediate Cost Reduction
- [x] Task #1: Analyze current patterns (DONE)
- [ ] Task #2: Add caching layer
- [ ] Task #4: Optimize prompts
- [ ] Task #5: Add token tracking
- **Expected Result:** Cost reduced from $23 to <$8 for 1000 incidents

### Week 2: Advanced Optimizations
- [ ] Task #3: Implement batching
- [ ] Task #6: Create workflow tracking
- [ ] Task #8: Build workflow APIs
- **Expected Result:** Cost reduced to <$3 for 1000 incidents

### Week 3: UI and Analytics
- [ ] Task #7: Implement log retrieval
- [ ] Task #9: Create workflow visualization UI
- [ ] Task #10: Add cost analytics dashboard
- **Expected Result:** Full visibility and control

### Week 4: Testing and Validation
- [ ] Task #11: Load testing with 1000 incidents
- [ ] Measure all metrics
- [ ] Fine-tune optimizations
- **Expected Result:** Validated <$5 cost for 1000 incidents

---

## Success Metrics

### Before Optimization
- AI Requests: 1000+ (1 per incident)
- Total Requests: 14,000+
- Cost: $23
- Requests per Incident: 144+
- Token Tracking: None
- Workflow Visibility: None

### After Optimization (Target)
- AI Requests: <100 (10x reduction via batching + caching)
- Total Requests: <2000 (reduce frontend over-fetching)
- Cost: <$5 (78% reduction)
- Requests per Incident: <10 (93% reduction)
- Token Tracking: Complete per-request tracking
- Workflow Visibility: Full pipeline visualization with per-step metrics

---

## Technical Implementation Details

### 1. Database Schema Changes

**New Model: AIRequest**
```python
class AIRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE)
    request_type = models.CharField(max_length=50)  # 'hypothesis', 'log_analysis', etc.
    input_tokens = models.IntegerField()
    output_tokens = models.IntegerField()
    total_tokens = models.IntegerField()
    cost_usd = models.DecimalField(max_digits=10, decimal_places=6)
    duration_ms = models.IntegerField()
    model_used = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)
```

**New Model: AnalysisStep**
```python
class AnalysisStep(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE)
    step_name = models.CharField(max_length=100)  # 'alert_received', 'logs_fetched', etc.
    status = models.CharField(max_length=20)  # 'pending', 'in_progress', 'completed', 'failed'
    input_data = models.JSONField(null=True)
    output_data = models.JSONField(null=True)
    input_tokens = models.IntegerField(null=True)
    output_tokens = models.IntegerField(null=True)
    duration_ms = models.IntegerField(null=True)
    started_at = models.DateTimeField(null=True)
    completed_at = models.DateTimeField(null=True)
    created_at = models.DateTimeField(auto_now_add=True)
```

**New Model: LogSnippet**
```python
class LogSnippet(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    incident = models.ForeignKey(Incident, on_delete=models.CASCADE)
    source = models.CharField(max_length=50)  # 'prometheus', 'grafana', 'loki'
    log_lines = models.JSONField()  # Array of log lines
    error_lines = models.JSONField()  # Indices of error lines
    timestamp_start = models.DateTimeField()
    timestamp_end = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
```

### 2. New API Endpoints

**AI Service:**
```
POST /generate-hypotheses-batch
  - Body: { incidents: [{ incident_id, title, description, service_name }] }
  - Response: { results: [{ incident_id, hypotheses }] }

GET /analytics/token-usage
  - Query: ?start_date, end_date, incident_id
  - Response: { total_requests, total_tokens, total_cost, breakdown: [] }
```

**Incident Service:**
```
GET /incidents/{id}/workflow
  - Response: { steps: [{ step_name, status, duration, tokens, cost }] }

GET /incidents/{id}/logs
  - Response: { source, log_lines, error_lines, timestamps }

GET /incidents/{id}/metrics
  - Response: { total_tokens, total_cost, ai_requests, step_breakdown }
```

**Integration Service:**
```
POST /logs/fetch
  - Body: { incident_id, source, time_range }
  - Response: { log_lines, error_indices }
```

### 3. Redis Cache Structure

**Cache Keys:**
```
hypothesis:{incident_id} → List of hypothesis IDs (TTL: 24h)
ai:generating:{incident_id} → Lock flag (TTL: 60s)
ai:batch:queue → List of pending incident IDs
ai:batch:processing → Lock flag (TTL: 300s)
```

### 4. Prompt Optimization Examples

**Before (500 tokens):**
```
You are an expert SRE analyzing a production incident.

Incident: High CPU usage on payment-service
Description: The payment service is experiencing elevated CPU usage...
Service: payment-service

Generate 3-5 possible root cause hypotheses. For each hypothesis, provide:
1. A clear, concise claim (one sentence)
2. A detailed description
3. A confidence score (0.0 to 1.0)
4. List of supporting evidence

Return your response in JSON format:
{
    "hypotheses": [
        {
            "claim": "...",
            "description": "...",
            "confidence_score": 0.85,
            "supporting_evidence": ["...", "..."]
        }
    ]
}
```

**After (200 tokens):**
```
Analyze incident and return 3-5 root cause hypotheses as JSON.

Incident: High CPU usage on payment-service
Details: Elevated CPU since deployment...
Service: payment-service

Format: {"hypotheses":[{"claim":"...","description":"...","confidence_score":0.85,"supporting_evidence":["..."]}]}
```

---

## Cost Calculation Reference

**GPT-4o-mini Pricing:**
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens

**Example Calculation:**
- Before: 1000 incidents × (500 input + 1500 output) = 500k input + 1.5M output
  - Cost: (500k × $0.150/1M) + (1.5M × $0.600/1M) = $0.075 + $0.90 = $0.975
- After (with batching, 100 AI calls): 100 calls × (200 input + 800 output)
  - Total: 20k input + 80k output
  - Cost: (20k × $0.150/1M) + (80k × $0.600/1M) = $0.003 + $0.048 = $0.051

**Reduction: $0.975 → $0.051 = 94.8% savings**

---

## Monitoring and Alerts

**Metrics to Track:**
1. Total AI requests per hour/day
2. Total token usage (input/output split)
3. Total cost per hour/day
4. Average cost per incident
5. Cache hit rate
6. Batch processing efficiency
7. Average response time

**Alerts to Set:**
- Cost exceeds $10/day
- Single incident costs >$0.50
- Cache hit rate <80%
- AI request rate >100/minute

---

## Risk Mitigation

**Potential Issues:**
1. **Batch processing delays** - Max 30s delay for incidents in queue
   - Mitigation: Flush queue immediately for critical severity
2. **Cache staleness** - Old hypotheses may not reflect new data
   - Mitigation: 24h TTL, manual invalidation option
3. **Reduced AI quality** - Shorter prompts may reduce accuracy
   - Mitigation: A/B test and validate hypothesis quality
4. **Increased complexity** - More moving parts
   - Mitigation: Comprehensive testing, monitoring, and rollback plan

---

## Implementation Progress Tracking

| Task | Status | Priority | Impact | ETA |
|------|--------|----------|--------|-----|
| #1: Analyze patterns | ✅ DONE | P0 | Documentation | Done |
| #2: Add caching | 🔄 IN PROGRESS | P1 | 50-90% reduction | Day 1 |
| #3: Implement batching | ⏳ PENDING | P2 | 5-10x reduction | Day 3 |
| #4: Optimize prompts | 🔄 IN PROGRESS | P1 | 40-60% reduction | Day 1 |
| #5: Token tracking | 🔄 IN PROGRESS | P1 | Visibility | Day 2 |
| #6: Workflow tracking | ⏳ PENDING | P2 | Visibility | Day 4 |
| #7: Log retrieval | ⏳ PENDING | P3 | Quality | Day 5 |
| #8: Workflow APIs | ⏳ PENDING | P2 | Backend | Day 4 |
| #9: Workflow UI | ⏳ PENDING | P2 | Frontend | Day 6 |
| #10: Analytics dashboard | ⏳ PENDING | P3 | Monitoring | Day 7 |
| #11: Load testing | ⏳ PENDING | P1 | Validation | Day 8 |

**Legend:**
- ✅ DONE - Completed
- 🔄 IN PROGRESS - Currently being worked on
- ⏳ PENDING - Not started yet
- ❌ BLOCKED - Waiting on dependency

---

## Next Steps

1. **Start with Task #2 (Caching)** - Immediate 50-90% reduction
2. **Then Task #4 (Prompt Optimization)** - Additional 40-60% reduction
3. **Add Task #5 (Token Tracking)** - Get visibility
4. **Test with 100 incidents** - Validate reductions
5. **Move to Phase 2** - Batching and workflow enhancements

**Target: Complete Phase 1 in 48 hours, achieve <$8 cost for 1000 incidents**
