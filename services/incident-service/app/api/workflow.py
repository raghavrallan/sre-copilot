"""
Workflow endpoints for incident analysis tracking
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from asgiref.sync import sync_to_async
import os

from shared.models.incident import Incident
from shared.models.analysis_step import AnalysisStep
from shared.models.ai_request import AIRequest

# Pricing Configuration from environment (per 1M tokens)
AI_INPUT_TOKEN_PRICE = float(os.getenv("AI_INPUT_TOKEN_PRICE", "0.150"))
AI_OUTPUT_TOKEN_PRICE = float(os.getenv("AI_OUTPUT_TOKEN_PRICE", "0.600"))

router = APIRouter()


@router.get("/incidents/{incident_id}/workflow")
async def get_incident_workflow(
    incident_id: str,
    project_id: str = Query(...)
):
    """
    Get the complete analysis workflow for an incident

    Returns:
    - All analysis steps with status, timing, and cost data
    - Shows the pipeline from alert received to solution generated
    """
    @sync_to_async
    def get_workflow_data():
        # Verify incident exists and belongs to project
        try:
            incident = Incident.objects.select_related('project').get(
                id=incident_id,
                project_id=project_id
            )
        except Incident.DoesNotExist:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Get all analysis steps for this incident
        steps = []
        try:
            for step in AnalysisStep.objects.filter(incident_id=incident_id).order_by('step_number'):
                step_data = {
                    "id": str(step.id),
                    "step_type": step.step_type,
                    "step_type_display": step.get_step_type_display(),
                    "step_number": step.step_number,
                    "status": step.status,
                    "status_display": step.get_status_display(),
                    "input_tokens": step.input_tokens,
                    "output_tokens": step.output_tokens,
                    "total_tokens": step.total_tokens,
                    "cost_usd": float(step.cost_usd) if step.cost_usd else None,
                    "duration_ms": step.duration_ms,
                    "started_at": step.started_at.isoformat() if step.started_at else None,
                    "completed_at": step.completed_at.isoformat() if step.completed_at else None,
                    "error_message": step.error_message if step.error_message else None
                }
                steps.append(step_data)
        except Exception as e:
            print(f"Error fetching analysis steps: {e}")
            # Return empty steps if there's an issue
            steps = []

        # Calculate workflow summary
        total_steps = len(steps)
        completed_steps = sum(1 for s in steps if s['status'] == 'completed')
        failed_steps = sum(1 for s in steps if s['status'] == 'failed')
        total_cost = sum(s['cost_usd'] for s in steps if s['cost_usd'])
        total_tokens = sum(s['total_tokens'] for s in steps if s['total_tokens'])

        return {
            "incident_id": incident_id,
            "workflow_summary": {
                "total_steps": total_steps,
                "completed_steps": completed_steps,
                "failed_steps": failed_steps,
                "in_progress_steps": total_steps - completed_steps - failed_steps,
                "total_cost_usd": total_cost,
                "total_tokens": total_tokens
            },
            "steps": steps
        }

    return await get_workflow_data()


@router.get("/incidents/{incident_id}/metrics")
async def get_incident_metrics(
    incident_id: str,
    project_id: str = Query(...)
):
    """
    Get comprehensive metrics for an incident

    Returns:
    - AI request breakdown
    - Token usage and costs
    - Performance metrics
    """
    @sync_to_async
    def get_metrics_data():
        # Verify incident exists and belongs to project
        try:
            incident = Incident.objects.select_related('project').get(
                id=incident_id,
                project_id=project_id
            )
        except Incident.DoesNotExist:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Get all AI requests for this incident
        ai_requests = []
        total_cost = 0.0
        total_tokens = 0
        total_input_tokens = 0
        total_output_tokens = 0

        for request in AIRequest.objects.filter(incident_id=incident_id).order_by('created_at'):
            request_data = {
                "id": str(request.id),
                "request_type": request.request_type,
                "input_tokens": request.input_tokens,
                "output_tokens": request.output_tokens,
                "total_tokens": request.total_tokens,
                "cost_usd": float(request.cost_usd),
                "duration_ms": request.duration_ms,
                "model_used": request.model_used,
                "success": request.success,
                "created_at": request.created_at.isoformat()
            }
            ai_requests.append(request_data)

            total_cost += float(request.cost_usd)
            total_tokens += request.total_tokens
            total_input_tokens += request.input_tokens
            total_output_tokens += request.output_tokens

        # Get analysis steps summary
        analysis_steps_count = AnalysisStep.objects.filter(incident_id=incident_id).count()

        return {
            "incident_id": incident_id,
            "incident_title": incident.title,
            "summary": {
                "total_ai_requests": len(ai_requests),
                "total_analysis_steps": analysis_steps_count,
                "total_cost_usd": total_cost,
                "total_tokens": total_tokens,
                "total_input_tokens": total_input_tokens,
                "total_output_tokens": total_output_tokens
            },
            "ai_requests": ai_requests,
            "cost_breakdown": {
                "input_cost_usd": (total_input_tokens / 1_000_000) * AI_INPUT_TOKEN_PRICE,
                "output_cost_usd": (total_output_tokens / 1_000_000) * AI_OUTPUT_TOKEN_PRICE,
                "total_cost_usd": total_cost
            }
        }

    return await get_metrics_data()
