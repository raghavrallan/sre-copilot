"""
Dashboard analysis endpoint - uses LLM to analyze Grafana dashboard
metadata, panel queries, and alert states to produce SRE insights.
"""
import json
import logging
import os
import time
from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter()

AZURE_OPENAI_ENDPOINT = os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_API_KEY = os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT = os.getenv("AZURE_OPENAI_DEPLOYMENT")
AZURE_OPENAI_API_VERSION = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

USE_MOCK = not AZURE_OPENAI_API_KEY or AZURE_OPENAI_API_KEY == ""


class PanelInfo(BaseModel):
    id: Optional[int] = None
    title: str = "Untitled"
    type: str = "unknown"
    queries: List[str] = []
    has_alert: bool = False
    thresholds: Optional[dict] = None


class AlertInfo(BaseModel):
    name: str = ""
    state: str = ""
    panelId: Optional[int] = None


class AnalyzeDashboardRequest(BaseModel):
    dashboard_title: str
    dashboard_description: str = ""
    panels: List[PanelInfo] = []
    alerts: List[AlertInfo] = []


class Insight(BaseModel):
    severity: str  # critical, warning, info
    title: str
    description: str
    recommendation: str


class AnalyzeDashboardResponse(BaseModel):
    dashboard_title: str
    summary: str
    insights: List[Insight]
    ai_powered: bool


@router.post("/analyze-dashboard", response_model=AnalyzeDashboardResponse)
async def analyze_dashboard(req: AnalyzeDashboardRequest):
    if USE_MOCK:
        return _mock_analysis(req)
    return await _real_analysis(req)


async def _real_analysis(req: AnalyzeDashboardRequest) -> AnalyzeDashboardResponse:
    try:
        from openai import AsyncAzureOpenAI

        client = AsyncAzureOpenAI(
            api_key=AZURE_OPENAI_API_KEY,
            api_version=AZURE_OPENAI_API_VERSION,
            azure_endpoint=AZURE_OPENAI_ENDPOINT,
        )

        panels_text = ""
        for p in req.panels:
            panels_text += f"\n- Panel \"{p.title}\" (type={p.type})"
            if p.queries:
                panels_text += f"  Queries: {'; '.join(p.queries[:3])}"
            if p.has_alert:
                panels_text += "  [HAS ALERT RULE]"

        alerts_text = ""
        firing = [a for a in req.alerts if a.state in ("alerting", "pending")]
        if firing:
            alerts_text = "\n\nFIRING ALERTS:\n" + "\n".join(
                f"- {a.name} (state={a.state})" for a in firing
            )

        prompt = f"""You are an expert SRE analyst. Analyze this Grafana dashboard and return JSON insights.

Dashboard: {req.dashboard_title}
{f'Description: {req.dashboard_description}' if req.dashboard_description else ''}

Panels ({len(req.panels)} total):{panels_text}
{alerts_text}

Return JSON: {{"summary":"1-2 sentence overall assessment","insights":[{{"severity":"critical|warning|info","title":"short title","description":"details","recommendation":"actionable advice"}}]}}

Focus on: firing alerts, error-tracking queries, resource saturation, missing monitoring gaps, and SRE best practices."""

        start = time.time()
        response = await client.chat.completions.create(
            model=AZURE_OPENAI_DEPLOYMENT,
            messages=[
                {"role": "system", "content": "SRE dashboard analyst. Return valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=1000,
        )
        duration_ms = int((time.time() - start) * 1000)
        logger.info("AI dashboard analysis took %dms", duration_ms)

        content = response.choices[0].message.content.strip()
        if content.startswith("```"):
            lines = content.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].strip() == "```":
                lines = lines[:-1]
            content = "\n".join(lines)

        result = json.loads(content)
        insights = [Insight(**i) for i in result.get("insights", [])]

        return AnalyzeDashboardResponse(
            dashboard_title=req.dashboard_title,
            summary=result.get("summary", "Analysis complete."),
            insights=insights,
            ai_powered=True,
        )

    except Exception as e:
        logger.error("AI dashboard analysis failed: %s", e)
        return _mock_analysis(req)


def _mock_analysis(req: AnalyzeDashboardRequest) -> AnalyzeDashboardResponse:
    insights: list[Insight] = []
    firing = [a for a in req.alerts if a.state in ("alerting", "pending")]

    if firing:
        insights.append(Insight(
            severity="critical",
            title=f"{len(firing)} alert(s) currently firing",
            description=", ".join(a.name for a in firing),
            recommendation="Investigate the firing alerts immediately. Check linked panels for root cause indicators.",
        ))

    error_panels = []
    resource_panels = []
    for p in req.panels:
        for q in p.queries:
            ql = q.lower()
            if any(kw in ql for kw in ("error", "5xx", "4xx", "exception", "failure")):
                error_panels.append(p.title)
                break
            if any(kw in ql for kw in ("cpu", "memory", "disk", "saturation", "load")):
                resource_panels.append(p.title)
                break

    if error_panels:
        insights.append(Insight(
            severity="warning",
            title=f"{len(error_panels)} panel(s) tracking errors",
            description=f"Panels: {', '.join(error_panels[:5])}",
            recommendation="Verify error rates are within acceptable SLO thresholds. Set up alert rules if not already configured.",
        ))

    if resource_panels:
        insights.append(Insight(
            severity="info",
            title=f"{len(resource_panels)} panel(s) monitoring resource usage",
            description=f"Panels: {', '.join(resource_panels[:5])}",
            recommendation="Ensure resource utilization stays below 80% saturation. Consider autoscaling if approaching limits.",
        ))

    panels_without_alerts = [p for p in req.panels if not p.has_alert and p.type not in ("text", "row", "stat")]
    if panels_without_alerts and len(panels_without_alerts) > len(req.panels) * 0.5:
        insights.append(Insight(
            severity="info",
            title=f"{len(panels_without_alerts)} panels lack alert rules",
            description="Many monitoring panels don't have associated alerts.",
            recommendation="Add alert rules to critical panels to enable proactive incident detection.",
        ))

    if not insights:
        insights.append(Insight(
            severity="info",
            title="Dashboard appears healthy",
            description=f"Reviewed {len(req.panels)} panels and {len(req.alerts)} alert rules.",
            recommendation="Continue monitoring. Consider expanding observability coverage.",
        ))

    return AnalyzeDashboardResponse(
        dashboard_title=req.dashboard_title,
        summary=f"Analyzed {len(req.panels)} panels, {len(req.alerts)} alerts, {len(firing)} firing.",
        insights=insights,
        ai_powered=False,
    )
