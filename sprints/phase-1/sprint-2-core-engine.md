# Sprint 2: Core Engine (Weeks 5-8)

**Goal:** Build hypothesis engine, Slack bot, and incident state machine
**Duration:** 4 weeks
**Dependencies:** Sprint 1 complete

---

## Sprint Objectives

By end of Sprint 2, we will have:
- ✅ Hypothesis confidence scoring working
- ✅ Slack bot responding to incidents
- ✅ Incident state machine implemented
- ✅ Evidence aggregator functional
- ✅ Basic incident timeline
- ✅ End-to-end flow: Alert → Hypotheses → Slack

**Success Criteria:**
- Slack bot posts incident context within 60s of alert
- Hypotheses ranked by confidence (deterministic scoring)
- User can provide feedback via Slack buttons
- Incident states transition correctly
- Can demo full incident flow

---

## Week 5: Hypothesis Confidence Scoring

### Day 1-3: Multi-Factor Confidence Model

**Tasks:**
- [ ] Create confidence scoring engine
  ```python
  # core/confidence.py
  from dataclasses import dataclass
  from typing import List, Dict

  @dataclass
  class ConfidenceRange:
      lower: float
      upper: float
      primary: float
      components: Dict[str, float]

  class HypothesisConfidence:
      def calculate(self, hypothesis: dict, context: dict) -> ConfidenceRange:
          """
          Multi-factor confidence scoring model
          """
          scores = {
              'signal_strength': self._score_signal_strength(hypothesis),
              'temporal_correlation': self._score_timing(hypothesis),
              'precedent_frequency': self._score_history(hypothesis),
              'evidence_quality': self._score_evidence(hypothesis),
              'human_validation': self._score_feedback(hypothesis)
          }

          weights = {
              'signal_strength': 0.25,
              'temporal_correlation': 0.20,
              'precedent_frequency': 0.20,
              'evidence_quality': 0.20,
              'human_validation': 0.15
          }

          base_confidence = sum(s * weights[k] for k, s in scores.items())
          uncertainty = self._calculate_uncertainty(scores)

          return ConfidenceRange(
              lower=max(0, base_confidence - uncertainty),
              upper=min(1, base_confidence + uncertainty),
              primary=base_confidence,
              components=scores
          )

      def _score_signal_strength(self, hypothesis: dict) -> float:
          """How strong is the metric deviation?"""
          deviation_sigma = hypothesis.get('deviation_sigma', 1.0)

          if deviation_sigma >= 3.0:
              return 0.9
          elif deviation_sigma >= 2.0:
              return 0.7
          elif deviation_sigma >= 1.0:
              return 0.4
          else:
              return 0.2

      def _score_timing(self, hypothesis: dict) -> float:
          """How well does timing align?"""
          time_delta_seconds = hypothesis.get('time_delta_seconds', 3600)

          # Perfect correlation: event within 5 minutes
          if time_delta_seconds < 300:
              return 0.95
          elif time_delta_seconds < 900:
              return 0.85
          elif time_delta_seconds < 1800:
              return 0.70
          else:
              return 0.30

      def _score_history(self, hypothesis: dict) -> float:
          """How often has this pattern occurred?"""
          similar_count = hypothesis.get('similar_incidents_count', 0)

          if similar_count >= 10:
              return 0.9
          elif similar_count >= 5:
              return 0.75
          elif similar_count >= 2:
              return 0.6
          elif similar_count == 1:
              return 0.5
          else:
              return 0.3

      def _score_evidence(self, hypothesis: dict) -> float:
          """Quality and quantity of supporting evidence"""
          evidence = hypothesis.get('evidence', [])
          contradictions = hypothesis.get('contradictions', [])

          if len(evidence) >= 3 and len(contradictions) == 0:
              return 0.95
          elif len(evidence) >= 2 and len(contradictions) == 0:
              return 0.80
          elif len(evidence) >= 1 and len(contradictions) == 0:
              return 0.70
          elif len(contradictions) > 0:
              return 0.40
          else:
              return 0.30

      def _score_feedback(self, hypothesis: dict) -> float:
          """Human validation history"""
          # Will be populated from historical data
          # For now, default to neutral
          return 0.5

      def _calculate_uncertainty(self, scores: Dict[str, float]) -> float:
          """Calculate confidence interval width based on score variance"""
          values = list(scores.values())
          variance = sum((x - sum(values)/len(values))**2 for x in values) / len(values)
          return min(0.15, variance * 0.5)
  ```
- [ ] Create hypothesis Django model
  ```python
  # models/hypothesis.py
  class Hypothesis(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4)
      incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='hypotheses')

      # Claim
      claim = models.TextField()
      description = models.TextField()

      # Confidence
      confidence_lower = models.FloatField()
      confidence_upper = models.FloatField()
      confidence_primary = models.FloatField()
      confidence_components = models.JSONField()

      # Evidence
      supporting_evidence = models.JSONField()
      contradicting_evidence = models.JSONField()

      # Historical context
      similar_incidents = models.JSONField(default=list)
      precedent_count = models.IntegerField(default=0)

      # Ranking
      rank = models.IntegerField()

      # User feedback
      user_feedback = models.CharField(max_length=50, null=True)  # accepted, rejected, uncertain
      feedback_timestamp = models.DateTimeField(null=True)
      feedback_user = models.ForeignKey('User', on_delete=models.SET_NULL, null=True)

      # Metadata
      created_at = models.DateTimeField(auto_now_add=True)

      class Meta:
          db_table = 'hypotheses'
          ordering = ['rank']
  ```
- [ ] Write unit tests for confidence scoring
- [ ] Test with mock hypotheses

**Deliverable:** Working confidence scoring model

---

### Day 4-5: Evidence Aggregator

**Tasks:**
- [ ] Create evidence aggregation engine
  ```python
  # core/evidence.py
  class EvidenceAggregator:
      async def aggregate(self, incident: Incident, context: dict) -> List[dict]:
          """
          Gather all evidence relevant to incident
          """
          evidence = []

          # Temporal correlations
          evidence.extend(await self._find_temporal_correlations(incident, context))

          # Metric deviations
          evidence.extend(await self._find_metric_deviations(incident))

          # Recent changes
          evidence.extend(await self._find_recent_changes(incident))

          # Dependency issues
          evidence.extend(await self._find_dependency_issues(incident, context))

          # Log patterns
          evidence.extend(await self._find_log_patterns(incident))

          return evidence

      async def _find_temporal_correlations(self, incident, context):
          # Events that occurred near incident time
          pass

      async def _find_metric_deviations(self, incident):
          # Metrics that deviated from baseline
          pass

      async def _find_recent_changes(self, incident):
          # Deployments, config changes
          pass
  ```
- [ ] Integrate evidence aggregator with hypothesis generation
- [ ] Test evidence quality

**Deliverable:** Working evidence aggregator

---

## Week 6: Slack Bot

### Day 1-3: Slack App Setup & Basic Bot

**Tasks:**
- [ ] Create Slack App in Slack API console
  - Set up bot user
  - Configure OAuth scopes:
    - `chat:write`
    - `chat:write.public`
    - `channels:read`
    - `channels:history`
    - `users:read`
    - `commands`
  - Set up Event Subscriptions
  - Set up Interactivity
- [ ] Implement Slack OAuth flow
  ```python
  # integrations/slack.py
  from slack_sdk.web.async_client import AsyncWebClient
  from slack_sdk.signature import SignatureVerifier

  class SlackIntegration:
      def __init__(self, bot_token: str):
          self.client = AsyncWebClient(token=bot_token)

      async def post_message(
          self,
          channel: str,
          text: str = None,
          blocks: List[dict] = None,
          thread_ts: str = None
      ):
          return await self.client.chat_postMessage(
              channel=channel,
              text=text,
              blocks=blocks,
              thread_ts=thread_ts
          )

      async def create_incident_thread(self, incident: Incident):
          # Post initial incident message
          pass

      async def update_with_hypotheses(self, incident: Incident, hypotheses: List[Hypothesis]):
          # Update thread with hypotheses
          pass
  ```
- [ ] Create Slack webhook endpoints
  ```python
  # api/v1/slack.py
  @router.post("/slack/events")
  async def slack_events(request: Request):
      # Handle Slack events
      pass

  @router.post("/slack/interactivity")
  async def slack_interactivity(request: Request):
      # Handle button clicks, menu selections
      pass

  @router.post("/slack/commands")
  async def slack_commands(request: Request):
      # Handle slash commands
      pass
  ```
- [ ] Implement signature verification
- [ ] Create basic message templates using Block Kit
  ```python
  # slack/templates.py
  def incident_alert_blocks(incident: Incident, context: dict) -> List[dict]:
      return [
          {
              "type": "header",
              "text": {
                  "type": "plain_text",
                  "text": f"🚨 {incident.severity.upper()}: {incident.title}"
              }
          },
          {
              "type": "section",
              "fields": [
                  {"type": "mrkdwn", "text": f"*Service:*\n{incident.service_name}"},
                  {"type": "mrkdwn", "text": f"*Started:*\n{incident.detected_at}"}
              ]
          },
          {"type": "divider"},
          {
              "type": "section",
              "text": {
                  "type": "mrkdwn",
                  "text": f"📊 *CONTEXT:*\n{format_context(context)}"
              }
          }
      ]
  ```
- [ ] Test bot in Slack workspace

**Deliverable:** Working Slack bot that can post messages

---

### Day 4-5: Interactive Components

**Tasks:**
- [ ] Implement hypothesis feedback buttons
  ```python
  def hypothesis_blocks(hypotheses: List[Hypothesis]) -> List[dict]:
      blocks = [
          {
              "type": "header",
              "text": {"type": "plain_text", "text": "💡 TOP HYPOTHESES"}
          }
      ]

      for i, hyp in enumerate(hypotheses[:3], 1):
          blocks.extend([
              {
                  "type": "section",
                  "text": {
                      "type": "mrkdwn",
                      "text": f"*{i}. {hyp.claim}* (confidence: {hyp.confidence_lower:.2f}-{hyp.confidence_upper:.2f})"
                  }
              },
              {
                  "type": "section",
                  "text": {
                      "type": "mrkdwn",
                      "text": format_evidence(hyp)
                  },
                  "accessory": {
                      "type": "button",
                      "text": {"type": "plain_text", "text": "✓ Accurate"},
                      "action_id": f"accept_hypothesis_{hyp.id}",
                      "style": "primary"
                  }
              },
              {
                  "type": "actions",
                  "elements": [
                      {
                          "type": "button",
                          "text": {"type": "plain_text", "text": "✗ Incorrect"},
                          "action_id": f"reject_hypothesis_{hyp.id}",
                          "style": "danger"
                      },
                      {
                          "type": "button",
                          "text": {"type": "plain_text", "text": "+ Add Evidence"},
                          "action_id": f"add_evidence_{hyp.id}"
                      }
                  ]
              },
              {"type": "divider"}
          ])

      return blocks
  ```
- [ ] Handle button click events
  ```python
  async def handle_hypothesis_feedback(
      action_id: str,
      user_id: str,
      value: str
  ):
      # Parse hypothesis ID from action_id
      hypothesis_id = action_id.split('_')[-1]

      # Update hypothesis with feedback
      hypothesis = await Hypothesis.objects.aget(id=hypothesis_id)
      hypothesis.user_feedback = value
      hypothesis.feedback_timestamp = timezone.now()
      await hypothesis.asave()

      # Update confidence model (learning)
      await update_confidence_weights(hypothesis)
  ```
- [ ] Implement slash commands
  ```python
  @router.post("/slack/commands")
  async def slack_commands(request: Request):
      form = await request.form()
      command = form.get('command')
      text = form.get('text')
      user_id = form.get('user_id')

      if command == '/sre':
          return await handle_sre_command(text, user_id)
  ```
- [ ] Test interactive components

**Deliverable:** Slack bot with working buttons and commands

---

## Week 7: Incident State Machine

### Day 1-3: State Machine Implementation

**Tasks:**
- [ ] Implement incident FSM
  ```python
  # core/incident_fsm.py
  from enum import Enum
  from typing import Optional

  class IncidentState(Enum):
      DETECTED = "detected"
      ACKNOWLEDGED = "acknowledged"
      INVESTIGATING = "investigating"
      MITIGATED = "mitigated"
      RESOLVED = "resolved"
      LEARNED = "learned"
      INCONCLUSIVE = "inconclusive"

  class IncidentFSM:
      TRANSITIONS = {
          IncidentState.DETECTED: [IncidentState.ACKNOWLEDGED, IncidentState.INCONCLUSIVE],
          IncidentState.ACKNOWLEDGED: [IncidentState.INVESTIGATING, IncidentState.INCONCLUSIVE],
          IncidentState.INVESTIGATING: [
              IncidentState.MITIGATED,
              IncidentState.RESOLVED,
              IncidentState.INCONCLUSIVE
          ],
          IncidentState.MITIGATED: [IncidentState.RESOLVED, IncidentState.INVESTIGATING],
          IncidentState.RESOLVED: [IncidentState.LEARNED],
          IncidentState.INCONCLUSIVE: [IncidentState.INVESTIGATING, IncidentState.LEARNED],
      }

      async def transition(
          self,
          incident: Incident,
          new_state: IncidentState,
          user: Optional[User] = None,
          reason: Optional[str] = None
      ):
          """Transition incident to new state"""
          # Validate transition
          current_state = IncidentState(incident.state)
          if new_state not in self.TRANSITIONS.get(current_state, []):
              raise ValueError(f"Invalid transition: {current_state} -> {new_state}")

          # Update timestamps
          if new_state == IncidentState.ACKNOWLEDGED:
              incident.acknowledged_at = timezone.now()
          elif new_state == IncidentState.MITIGATED:
              incident.mitigated_at = timezone.now()
          elif new_state == IncidentState.RESOLVED:
              incident.resolved_at = timezone.now()

          # Log transition
          await self._log_transition(incident, current_state, new_state, user, reason)

          # Trigger hooks
          await self._trigger_hooks(incident, new_state)

          # Update state
          incident.state = new_state.value
          await incident.asave()

      async def _log_transition(self, incident, old_state, new_state, user, reason):
          # Create state transition log entry
          pass

      async def _trigger_hooks(self, incident, new_state):
          # Trigger workflows based on state
          if new_state == IncidentState.RESOLVED:
              await generate_postmortem_draft(incident)
  ```
- [ ] Create state transition log model
  ```python
  # models/incident_state_transition.py
  class IncidentStateTransition(models.Model):
      id = models.UUIDField(primary_key=True, default=uuid.uuid4)
      incident = models.ForeignKey(Incident, on_delete=models.CASCADE, related_name='state_transitions')

      from_state = models.CharField(max_length=50)
      to_state = models.CharField(max_length=50)

      user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
      reason = models.TextField(null=True)

      timestamp = models.DateTimeField(auto_now_add=True)

      class Meta:
          db_table = 'incident_state_transitions'
          ordering = ['timestamp']
  ```
- [ ] Add state machine to incident workflow
- [ ] Test all state transitions

**Deliverable:** Working incident state machine

---

### Day 4-5: Incident Timeline

**Tasks:**
- [ ] Create timeline reconstruction service
  ```python
  # core/timeline.py
  class IncidentTimeline:
      async def build(self, incident: Incident) -> List[dict]:
          """
          Build complete incident timeline from all sources
          """
          events = []

          # Signals
          async for signal in incident.signals.all():
              events.append({
                  'timestamp': signal.timestamp,
                  'type': 'signal',
                  'severity': signal.severity,
                  'description': self._format_signal(signal)
              })

          # State transitions
          async for transition in incident.state_transitions.all():
              events.append({
                  'timestamp': transition.timestamp,
                  'type': 'state_change',
                  'description': f"{transition.from_state} → {transition.to_state}"
              })

          # Hypotheses
          async for hypothesis in incident.hypotheses.all():
              events.append({
                  'timestamp': hypothesis.created_at,
                  'type': 'hypothesis',
                  'description': hypothesis.claim
              })

          # User actions (from audit log)
          # ... etc

          # Sort by timestamp
          events.sort(key=lambda x: x['timestamp'])

          return events
  ```
- [ ] Add timeline API endpoint
  ```python
  @router.get("/incidents/{incident_id}/timeline")
  async def get_incident_timeline(incident_id: UUID):
      incident = await Incident.objects.aget(id=incident_id)
      timeline = await IncidentTimeline().build(incident)
      return timeline
  ```
- [ ] Add Slack command for timeline query
- [ ] Test timeline reconstruction

**Deliverable:** Working incident timeline

---

## Week 8: End-to-End Integration

### Day 1-3: Full Incident Flow

**Tasks:**
- [ ] Implement complete incident processing pipeline
  ```python
  # core/incident_processor.py
  class IncidentProcessor:
      async def process_alert(self, signal: Signal):
          """
          Complete incident processing flow
          """
          # 1. Create or update incident
          incident = await self._get_or_create_incident(signal)

          # 2. Generate context snapshot
          context = await ContextSnapshot().generate(incident, signal.tenant)

          # 3. Aggregate evidence
          evidence = await EvidenceAggregator().aggregate(incident, context)

          # 4. Generate hypothesis candidates (AI)
          candidates = await ClaudeClient().generate_hypotheses(context, evidence)

          # 5. Score hypotheses (deterministic)
          scored_hypotheses = []
          for candidate in candidates:
              confidence = HypothesisConfidence().calculate(candidate, context)
              hypothesis = await Hypothesis.objects.acreate(
                  incident=incident,
                  claim=candidate['claim'],
                  confidence_lower=confidence.lower,
                  confidence_upper=confidence.upper,
                  confidence_primary=confidence.primary,
                  confidence_components=confidence.components,
                  supporting_evidence=candidate['supporting_evidence'],
                  contradicting_evidence=candidate.get('contradicting_evidence', [])
              )
              scored_hypotheses.append(hypothesis)

          # 6. Rank and filter
          top_hypotheses = await self._rank_hypotheses(scored_hypotheses)

          # 7. Post to Slack
          await self._notify_slack(incident, context, top_hypotheses)

          # 8. Transition state
          await IncidentFSM().transition(incident, IncidentState.ACKNOWLEDGED)

          return incident
  ```
- [ ] Wire up PagerDuty webhook → Incident processing
- [ ] Test end-to-end flow
- [ ] Measure latency at each step

**Deliverable:** Complete alert-to-Slack flow working

---

### Day 4-5: Polish & Testing

**Tasks:**
- [ ] Improve Slack message formatting
- [ ] Add loading states (show "Analyzing..." while AI processes)
- [ ] Error handling and retries
- [ ] Performance optimization
  - Database query optimization
  - Parallel processing where possible
  - Caching
- [ ] Integration tests
- [ ] Load testing (simulate multiple concurrent incidents)

**Deliverable:** Production-ready incident processing

---

## Sprint 2 Demo

**Demo Flow:**
1. Trigger test PagerDuty incident
2. Show Slack notification within 60s
3. Show context snapshot
4. Show ranked hypotheses with confidence scores
5. Provide feedback via Slack buttons
6. Show incident state transitions
7. Query timeline via Slack

**Demo Checklist:**
- [ ] Alert triggers incident creation
- [ ] Context generated from Prometheus + mock data
- [ ] Hypotheses ranked by confidence
- [ ] Slack message formatted nicely
- [ ] Buttons work for feedback
- [ ] State machine transitions correctly
- [ ] Timeline shows all events

---

## Sprint 2 Metrics

| Metric | Target | Actual |
|--------|--------|--------|
| Alert → Slack notification | < 60s | ___ |
| Hypothesis generation | < 30s | ___ |
| Confidence scoring accuracy | > 70% | ___ |
| Slack bot uptime | 99%+ | ___ |
| User feedback response time | < 2s | ___ |

---

## Sprint 2 Retrospective

- What went well?
- What didn't go well?
- Any blockers?
- Scope changes needed for Sprint 3?

---

## Next Sprint Preview

**Sprint 3: Features (Runbooks, RCA, Post-mortems)**
- Runbook semantic search
- RCA assistant
- Post-mortem generation
- Natural language queries via Slack
