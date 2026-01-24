"""
Dummy workflow endpoints for demonstration (no database required)
"""
from fastapi import APIRouter, Query
from datetime import datetime, timedelta
import random

router = APIRouter()


@router.get("/incidents/{incident_id}/workflow")
async def get_incident_workflow_dummy(
    incident_id: str,
    project_id: str = Query(...)
):
    """
    Get workflow for an incident (DUMMY DATA)
    """

    steps = [
        {
            "id": "step-1",
            "step_type": "alert_received",
            "step_type_display": "Alert Received",
            "step_number": 1,
            "status": "completed",
            "status_display": "Completed",
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "cost_usd": None,
            "duration_ms": 150,
            "started_at": (datetime.now() - timedelta(minutes=10)).isoformat(),
            "completed_at": (datetime.now() - timedelta(minutes=10)).isoformat(),
            "error_message": None
        },
        {
            "id": "step-2",
            "step_type": "source_identified",
            "step_type_display": "Source Identified",
            "step_number": 2,
            "status": "completed",
            "status_display": "Completed",
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "cost_usd": None,
            "duration_ms": 200,
            "started_at": (datetime.now() - timedelta(minutes=9, seconds=50)).isoformat(),
            "completed_at": (datetime.now() - timedelta(minutes=9, seconds=48)).isoformat(),
            "error_message": None
        },
        {
            "id": "step-3",
            "step_type": "platform_details",
            "step_type_display": "Platform Details Fetched",
            "step_number": 3,
            "status": "completed",
            "status_display": "Completed",
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "cost_usd": None,
            "duration_ms": 450,
            "started_at": (datetime.now() - timedelta(minutes=9, seconds=45)).isoformat(),
            "completed_at": (datetime.now() - timedelta(minutes=9, seconds=40)).isoformat(),
            "error_message": None
        },
        {
            "id": "step-4",
            "step_type": "logs_fetched",
            "step_type_display": "Logs Retrieved",
            "step_number": 4,
            "status": "completed",
            "status_display": "Completed",
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "cost_usd": None,
            "duration_ms": 1200,
            "started_at": (datetime.now() - timedelta(minutes=9, seconds=35)).isoformat(),
            "completed_at": (datetime.now() - timedelta(minutes=9, seconds=23)).isoformat(),
            "error_message": None
        },
        {
            "id": "step-5",
            "step_type": "hypothesis_generated",
            "step_type_display": "Hypothesis Generated",
            "step_number": 5,
            "status": "completed",
            "status_display": "Completed",
            "input_tokens": 215,
            "output_tokens": 587,
            "total_tokens": 802,
            "cost_usd": 0.000885,
            "duration_ms": 3450,
            "started_at": (datetime.now() - timedelta(minutes=9, seconds=20)).isoformat(),
            "completed_at": (datetime.now() - timedelta(minutes=9, seconds=5)).isoformat(),
            "error_message": None
        },
        {
            "id": "step-6",
            "step_type": "solution_generated",
            "step_type_display": "Solution Generated",
            "step_number": 6,
            "status": "in_progress",
            "status_display": "In Progress",
            "input_tokens": None,
            "output_tokens": None,
            "total_tokens": None,
            "cost_usd": None,
            "duration_ms": None,
            "started_at": (datetime.now() - timedelta(minutes=9)).isoformat(),
            "completed_at": None,
            "error_message": None
        }
    ]

    # Calculate summary
    completed_steps = sum(1 for s in steps if s['status'] == 'completed')
    failed_steps = sum(1 for s in steps if s['status'] == 'failed')
    total_cost = sum(s['cost_usd'] for s in steps if s['cost_usd'])
    total_tokens = sum(s['total_tokens'] for s in steps if s['total_tokens'])

    return {
        "incident_id": incident_id,
        "workflow_summary": {
            "total_steps": len(steps),
            "completed_steps": completed_steps,
            "failed_steps": failed_steps,
            "in_progress_steps": len(steps) - completed_steps - failed_steps,
            "total_cost_usd": total_cost,
            "total_tokens": total_tokens
        },
        "steps": steps
    }


@router.get("/incidents/{incident_id}/metrics")
async def get_incident_metrics_dummy(
    incident_id: str,
    project_id: str = Query(...)
):
    """
    Get metrics for an incident (DUMMY DATA)
    """

    num_requests = random.randint(1, 2)
    total_input = random.randint(200, 300)
    total_output = random.randint(500, 800)
    total_tokens = total_input + total_output

    return {
        "incident_id": incident_id,
        "incident_title": "High CPU Usage on payment-service",
        "summary": {
            "total_ai_requests": num_requests,
            "total_analysis_steps": 6,
            "total_cost_usd": (total_input * 0.150 / 1_000_000) + (total_output * 0.600 / 1_000_000),
            "total_tokens": total_tokens,
            "total_input_tokens": total_input,
            "total_output_tokens": total_output
        },
        "ai_requests": [
            {
                "id": f"req-{i}",
                "request_type": "hypothesis",
                "input_tokens": random.randint(180, 250),
                "output_tokens": random.randint(450, 700),
                "total_tokens": random.randint(630, 950),
                "cost_usd": random.uniform(0.0006, 0.001),
                "duration_ms": random.randint(2500, 4500),
                "model_used": "gpt-4o-mini",
                "success": True,
                "created_at": (datetime.now() - timedelta(minutes=i*5)).isoformat()
            }
            for i in range(num_requests)
        ],
        "cost_breakdown": {
            "input_cost_usd": (total_input / 1_000_000) * 0.150,
            "output_cost_usd": (total_output / 1_000_000) * 0.600,
            "total_cost_usd": (total_input * 0.150 / 1_000_000) + (total_output * 0.600 / 1_000_000)
        }
    }
