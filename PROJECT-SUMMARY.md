# SRE Copilot - Project Summary

**AI-Powered SRE Platform: From Incident Response to Autonomous Operations**

---

## What Is This Project?

SRE Copilot is an enterprise SaaS platform that uses AI to help Site Reliability Engineers manage production incidents more effectively, predict issues before they impact users, and eventually automate remediation tasks with graduated autonomy.

**Think of it as:** GitHub Copilot, but for production operations instead of code.

---

## The Problem We Solve

### Current State (Manual SRE)
- ⏰ **Alert Fatigue**: Too many noisy alerts, hard to prioritize
- 🔍 **Context Switching**: Engineers manually correlate metrics, logs, deployments
- 📚 **Tribal Knowledge**: Solutions live in people's heads, not systems
- ⏱️ **Slow MTTR**: Average 45+ minutes to understand and resolve incidents
- 🔁 **Repetitive Toil**: Same issues keep happening, manual responses each time

### Future State (With SRE Copilot)
- ✅ **Intelligent Triage**: AI ranks incidents by actual impact
- 🧠 **Instant Context**: All relevant data assembled in 60 seconds
- 💡 **Smart Suggestions**: Top 3 root cause hypotheses with confidence scores
- 📖 **Automated Runbooks**: Right procedure suggested automatically
- 🤖 **Gradual Autonomy**: Safe, approved automation for common issues

---

## Three-Phase Delivery

### Phase 1: Intelligence (Months 1-4) - **Building Now**

**What It Does:**
When a PagerDuty alert fires → Slack bot immediately posts:
- What's happening (symptoms)
- What changed recently (deployments, configs)
- Top 3 hypotheses (with confidence scores)
- Recommended runbooks
- Similar past incidents

**Value:** 30% faster MTTR, learn from history

**Tech:** FastAPI + Django ORM + Claude AI + Slack + Prometheus

**Users:** On-call engineers via Slack

---

### Phase 2: Prediction (Months 5-9)

**What It Does:**
- Detects anomalies 3-12 hours before user impact
- "Disk will be full in 4 hours" (not "Disk is 70% full")
- Reduces 70% of noisy alerts through correlation
- Weekly capacity and trend reports

**Value:** Prevent incidents, not just react

**Tech:** ML models (Prophet, Isolation Forest), TimescaleDB

**Users:** SREs get proactive alerts, not just reactive

---

### Phase 3: Automation (Months 10-15)

**What It Does:**
Safe, graduated automation:
- **Low risk** (restart pod, clear cache) → Auto-execute
- **Medium risk** (scale replicas) → Notify + execute if no response in 5min
- **High risk** (rollback deployment) → Require explicit approval

All actions:
- Logged to audit trail
- Follow approved policies
- Reversible or have rollback plans
- Show expected impact before execution

**Value:** 15 hours/week toil reduction, 25% cost savings

**Tech:** Temporal.io workflows, policy engine, cloud SDKs

**Users:** Autonomous operations with human oversight

---

## How It Works (Technical Flow)

```
1. Signal Sources (Prometheus, PagerDuty, etc.)
        ↓
2. Ingestion Layer (normalize, deduplicate, route)
        ↓
3. Context Assembly (gather all relevant data)
        ↓
4. AI Hypothesis Generation (Claude API)
        ↓
5. Deterministic Confidence Scoring (multi-factor model)
        ↓
6. Slack Notification (human in the loop)
        ↓
7. User Feedback (learning loop)
        ↓
8. [Phase 3] Autonomous Execution (with policies)
```

**Key Principle:** LLM assists, deterministic code decides

---

## Why This Architecture?

### LLM Role (Supporting, Not Primary)

**Wrong:**
```
decision = claude.decide(incident)  ❌
```

**Right:**
```
candidates = claude.generate_hypotheses(incident)     # AI assists
scored = confidence_engine.score(candidates)          # Deterministic
best = policy_engine.select(scored)                   # Rules
explanation = claude.explain(best)                    # AI explains
```

**Why:** Auditability, reproducibility, compliance (SOC2, ISO27001)

---

### Confidence Model (Multi-Factor, Not LLM Intuition)

Each hypothesis scored on 5 factors:
1. **Signal Strength** (0.25 weight): How severe is the deviation?
2. **Temporal Correlation** (0.20): Did something change right before symptoms?
3. **Precedent Frequency** (0.20): Have we seen this before?
4. **Evidence Quality** (0.20): Multiple sources? Contradictions?
5. **Human Validation** (0.15): Historical acceptance rate

**Result:** Confidence range [0.65, 0.82] with component breakdown

**Why:** Explainable, debuggable, improvable

---

## Technology Stack Summary

### Backend
- **FastAPI** (async Python API)
- **Django ORM** (database layer, migrations)
- **PostgreSQL** (multi-tenant data)
- **Redis** (cache, queues)
- **Claude API** (AI reasoning)
- **Pinecone** (vector search for runbooks)

### Frontend
- **React 18 + TypeScript**
- **shadcn/ui + Tailwind** (beautiful, accessible UI)
- **Zustand** (state management)
- **Recharts** (charts)

### Infrastructure
- **Azure** (cloud platform)
- **Kubernetes** (AKS - container orchestration)
- **Terraform** (infrastructure as code)
- **GitHub Actions** (CI/CD)

### Integrations (Phase 1)
- Prometheus (metrics)
- PagerDuty (incidents)
- Slack (notifications & bot)

---

## Business Model

### Target Customers
- High-growth startups (10-50 engineers)
- SaaS companies with SRE teams
- Companies with high incident volumes (>20/month)

### Pricing (SaaS)
- **Starter:** $499/month (Phase 1, 5 services)
- **Professional:** $1,499/month (Phases 1+2, 20 services)
- **Enterprise:** $4,999/month (All phases, unlimited)

### Revenue Projections
- **Year 1:** $50K MRR (35 customers)
- **Year 2:** $250K MRR (120 customers)
- **Year 3:** $1M MRR (300 customers)

### Unit Economics
- **COGS:** $350-1,200/month per customer
- **Gross Margin:** 60-85%
- **CAC Payback:** ~6 months (product-led growth)

---

## Competitive Advantages

### What We're NOT
- ❌ Not an observability platform (we integrate with them)
- ❌ Not an incident management tool (we enhance them)
- ❌ Not a runbook automation tool (we're smarter)

### What We ARE
- ✅ **AI-first incident intelligence** (context + hypotheses)
- ✅ **Learning system** (gets better with every incident)
- ✅ **Graduated autonomy** (Phase 1 → 2 → 3 trust building)
- ✅ **Multi-tenant SaaS** (no self-hosting complexity)

### Moats
1. **Incident Corpus**: Grows with each customer → better ML
2. **Policy Templates**: Years to build comprehensive library
3. **Context Assembly**: Hard to replicate well
4. **Trust Progression**: Organizational knowledge

---

## Success Metrics

### Phase 1 (After 16 Weeks)
| Metric | Target | How We Measure |
|--------|--------|----------------|
| Adoption | 60%+ use weekly | Slack engagement |
| Trust | 70%+ accurate | Hypothesis acceptance rate |
| MTTR | -30% | Time to resolution |
| NPS | 40+ | User surveys |
| Uptime | 99%+ | System monitoring |

### Phase 2 (After 9 Months)
- 40% incidents prevented
- 70% alert noise reduction
- 80% prediction accuracy (3hr horizon)

### Phase 3 (After 15 Months)
- 15 hrs/week toil reduction
- 20-30% infra cost savings
- Zero harmful autonomous actions

---

## Risk Mitigation

### Technical Risks
| Risk | Mitigation |
|------|------------|
| AI hallucinations | Always show evidence, allow feedback |
| Claude API costs | Aggressive caching (70% reduction) |
| Integration complexity | Focus on 2-3 key integrations first |
| Scale/performance | Multi-tenant from day 1, sharding |

### Business Risks
| Risk | Mitigation |
|------|------------|
| No one trusts AI | Phase 1 = suggestions only |
| Incumbents add AI | Our depth > their breadth |
| Long sales cycles | Product-led growth motion |
| Compliance | Audit trails from day 1 |

---

## Decision Gates

### Gate 1 (Week 8): Continue or Pivot?
**Question:** Do 3+ beta users ask AI before Slack?
- ✅ Yes → Continue Phase 1
- ❌ No → Pivot UX or messaging

### Gate 2 (Week 16): Build Phase 2?
**Question:** Do 5+ customers pay for Phase 1?
- ✅ Yes → Build Phase 2
- ❌ No → Improve Phase 1 or pivot

### Gate 3 (Month 9): Build Phase 3?
**Question:** Do customers trust Phase 2 predictions?
- ✅ Yes → Build Phase 3
- ❌ No → Fix accuracy first

---

## Team & Timeline

### Solo Build (Realistic)
**You can build Phase 1 solo in 16 weeks:**
- 8-10 hour days (your pattern)
- Leverage Azure/React expertise
- Use managed services (Pinecone, Temporal Cloud)
- Focus on MVP, not polish

### Optimal Team (Scale Faster)
- 1 Backend Engineer (Python/FastAPI) - You
- 1 Frontend Engineer (React/TypeScript) - Hire/contract
- 1 Integration Engineer (APIs, webhooks) - Part-time
- 1 Designer (UI/UX) - Contract, week 8+

### Advisors
- 1 Senior SRE (design validation) - Equity advisor
- 1 AI Engineer (Claude optimization) - Part-time consult

---

## Next Immediate Steps

### Week 1 (Right Now)
1. **Day 1-2:** Create repos, Docker setup, Django + FastAPI skeleton
2. **Day 3-5:** Database schema, migrations, test data
3. **Day 6-7:** Azure AD integration, basic auth

**Goal:** Authenticated API that can query database

### Week 2
1. Prometheus integration (query metrics)
2. PagerDuty webhook receiver
3. Claude API wrapper with caching
4. Context snapshot generator (basic)

**Goal:** Can receive alerts and query AI

### Week 3-4
- Complete context assembly
- Evidence aggregation
- Hypothesis generation + scoring
- Basic Slack bot

**Goal:** Alert → Slack notification with hypotheses

---

## Key Differentiators

1. **Deterministic Core, AI Assistant**
   - Not "AI makes decisions"
   - AI generates candidates, code scores them
   - Auditable, reproducible, compliant

2. **Graduated Autonomy**
   - Phase 1: Read-only suggestions
   - Phase 2: Predictive alerts
   - Phase 3: Autonomous actions (with policies)
   - Trust builds over time

3. **Learning System**
   - User feedback improves confidence model
   - Incident corpus grows
   - Gets smarter with every customer

4. **Multi-Tenant SaaS**
   - No self-hosting
   - Instant onboarding
   - Shared learning (anonymized)

---

## Resources

### Documentation
- [Complete Architecture](diagrams/complete-architecture.md)
- [Phase 1 Features](docs/features/phase-1-v1-features.md)
- [Data Models](docs/data-models/core-models.md)
- [Tech Stack](docs/tech-stack/technology-choices.md)
- [Sprint 1 Plan](sprints/phase-1/sprint-1-foundation.md)
- [Sprint 2 Plan](sprints/phase-1/sprint-2-core-engine.md)

### External Links
- Claude API: https://www.anthropic.com/claude
- Pinecone: https://www.pinecone.io/
- FastAPI: https://fastapi.tiangolo.com/
- shadcn/ui: https://ui.shadcn.com/

---

## The Vision

**Today:** Engineers spend 60% of incident time gathering context

**Phase 1:** AI assembles context in 60 seconds → 30% faster MTTR

**Phase 2:** AI predicts 40% of incidents before user impact

**Phase 3:** AI handles 70% of toil autonomously, safely

**Future:** SRE teams focus on architecture and prevention, not firefighting

---

**Let's build the future of SRE operations.**

---

_Last Updated: 2026-01-19_
_Status: Phase 1 Planning Complete, Ready to Build_
