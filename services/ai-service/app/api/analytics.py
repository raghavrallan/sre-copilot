"""
Analytics endpoints for AI service cost monitoring
"""
from fastapi import APIRouter, Query, HTTPException
from typing import List, Optional
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from asgiref.sync import sync_to_async
import json

from shared.models.ai_request import AIRequest
from shared.models.analysis_step import AnalysisStep
from shared.models.incident import Incident

router = APIRouter()


@router.get("/analytics/token-usage")
async def get_token_usage(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    incident_id: Optional[str] = Query(None, description="Filter by incident ID"),
    project_id: Optional[str] = Query(None, description="Project ID")
):
    """
    Get token usage statistics

    Returns total tokens, costs, and breakdown by request type
    """
    @sync_to_async
    def get_token_usage_data():
        # Build query filters
        filters = {}
        if incident_id:
            filters['incident_id'] = incident_id
        if project_id:
            filters['incident__project_id'] = project_id

        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            filters['created_at__gte'] = timezone.make_aware(start_dt)

        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            filters['created_at__lt'] = timezone.make_aware(end_dt)

        # Get all AI requests matching filters
        ai_requests = AIRequest.objects.filter(**filters)

        # Calculate totals
        total_requests = ai_requests.count()

        if total_requests == 0:
            return {
                "total_requests": 0,
                "total_input_tokens": 0,
                "total_output_tokens": 0,
                "total_tokens": 0,
                "total_cost_usd": 0.0,
                "avg_duration_ms": 0,
                "breakdown_by_type": [],
                "timeline": []
            }

        # Aggregate totals
        aggregates = ai_requests.aggregate(
            total_input=Sum('input_tokens'),
            total_output=Sum('output_tokens'),
            total_cost=Sum('cost_usd'),
            avg_duration=Avg('duration_ms')
        )

        # Breakdown by request type
        breakdown = []
        request_types = ai_requests.values_list('request_type', flat=True).distinct()
        for request_type in request_types:
            type_requests = ai_requests.filter(request_type=request_type)
            type_aggregates = type_requests.aggregate(
                count=Count('id'),
                total_input=Sum('input_tokens'),
                total_output=Sum('output_tokens'),
                total_cost=Sum('cost_usd')
            )
            breakdown.append({
                "request_type": request_type,
                "count": type_aggregates['count'],
                "input_tokens": type_aggregates['total_input'] or 0,
                "output_tokens": type_aggregates['total_output'] or 0,
                "total_tokens": (type_aggregates['total_input'] or 0) + (type_aggregates['total_output'] or 0),
                "cost_usd": float(type_aggregates['total_cost'] or 0)
            })

        # Timeline data (daily breakdown for last 7 days)
        timeline = []
        if not start_date:
            start_date_str = (timezone.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        else:
            start_date_str = start_date

        current_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        end_date_obj = datetime.strptime(end_date, "%Y-%m-%d") if end_date else timezone.now()

        while current_date <= end_date_obj:
            day_start = timezone.make_aware(current_date)
            day_end = day_start + timedelta(days=1)

            day_requests = ai_requests.filter(
                created_at__gte=day_start,
                created_at__lt=day_end
            )

            day_aggregates = day_requests.aggregate(
                count=Count('id'),
                total_cost=Sum('cost_usd')
            )

            timeline.append({
                "date": current_date.strftime("%Y-%m-%d"),
                "requests": day_aggregates['count'] or 0,
                "cost_usd": float(day_aggregates['total_cost'] or 0)
            })

            current_date += timedelta(days=1)

        return {
            "total_requests": total_requests,
            "total_input_tokens": aggregates['total_input'] or 0,
            "total_output_tokens": aggregates['total_output'] or 0,
            "total_tokens": (aggregates['total_input'] or 0) + (aggregates['total_output'] or 0),
            "total_cost_usd": float(aggregates['total_cost'] or 0),
            "avg_duration_ms": int(aggregates['avg_duration'] or 0),
            "breakdown_by_type": breakdown,
            "timeline": timeline
        }

    return await get_token_usage_data()


@router.get("/analytics/incident-metrics/{incident_id}")
async def get_incident_metrics(
    incident_id: str,
    project_id: Optional[str] = Query(None, description="Project ID")
):
    """
    Get detailed metrics for a specific incident

    Returns:
    - All AI requests made for this incident
    - Analysis steps with token usage
    - Total cost breakdown
    """
    @sync_to_async
    def get_incident_metrics_data():
        # Verify incident exists
        try:
            incident = Incident.objects.get(id=incident_id)
        except Incident.DoesNotExist:
            raise HTTPException(status_code=404, detail="Incident not found")

        # Get all AI requests for this incident
        ai_requests = []
        for request in AIRequest.objects.filter(incident_id=incident_id).order_by('created_at'):
            ai_requests.append({
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
            })

        # Get all analysis steps for this incident
        analysis_steps = []
        for step in AnalysisStep.objects.filter(incident_id=incident_id).order_by('step_number'):
            analysis_steps.append({
                "id": str(step.id),
                "step_type": step.step_type,
                "step_number": step.step_number,
                "status": step.status,
                "input_tokens": step.input_tokens,
                "output_tokens": step.output_tokens,
                "total_tokens": step.total_tokens,
                "cost_usd": float(step.cost_usd) if step.cost_usd else None,
                "duration_ms": step.duration_ms,
                "started_at": step.started_at.isoformat() if step.started_at else None,
                "completed_at": step.completed_at.isoformat() if step.completed_at else None
            })

        # Calculate totals
        total_cost = sum(r['cost_usd'] for r in ai_requests)
        total_tokens = sum(r['total_tokens'] for r in ai_requests)
        total_requests = len(ai_requests)

        return {
            "incident_id": incident_id,
            "incident_title": incident.title,
            "summary": {
                "total_requests": total_requests,
                "total_tokens": total_tokens,
                "total_cost_usd": total_cost
            },
            "ai_requests": ai_requests,
            "analysis_steps": analysis_steps
        }

    return await get_incident_metrics_data()


@router.get("/analytics/cost-summary")
async def get_cost_summary(
    days: int = Query(7, description="Number of days to look back"),
    project_id: Optional[str] = Query(None, description="Project ID")
):
    """
    Get overall cost summary and statistics

    Returns:
    - Total costs over time period
    - Most expensive incidents
    - Average cost per incident
    - Optimization recommendations
    """
    @sync_to_async
    def get_cost_summary_data():
        start_date = timezone.now() - timedelta(days=days)

        # Build filters
        filters = {'created_at__gte': start_date}
        if project_id:
            filters['incident__project_id'] = project_id

        # Get all requests in time period
        ai_requests = AIRequest.objects.filter(**filters)

        # Overall stats
        overall_stats = ai_requests.aggregate(
            total_requests=Count('id'),
            total_cost=Sum('cost_usd'),
            total_tokens=Sum('total_tokens'),
            avg_cost_per_request=Avg('cost_usd')
        )

        # Most expensive incidents
        expensive_incidents = []
        incident_ids = ai_requests.values_list('incident_id', flat=True).distinct()

        incident_costs = []
        for incident_id in incident_ids:
            incident_requests = ai_requests.filter(incident_id=incident_id)
            incident_aggregates = incident_requests.aggregate(
                total_cost=Sum('cost_usd'),
                total_requests=Count('id')
            )

            try:
                incident = Incident.objects.get(id=incident_id)
                incident_costs.append({
                    "incident_id": str(incident_id),
                    "incident_title": incident.title,
                    "total_cost_usd": float(incident_aggregates['total_cost'] or 0),
                    "total_requests": incident_aggregates['total_requests']
                })
            except Incident.DoesNotExist:
                pass

        # Sort by cost and get top 10
        expensive_incidents = sorted(incident_costs, key=lambda x: x['total_cost_usd'], reverse=True)[:10]

        # Calculate cache effectiveness
        incident_filters = {'created_at__gte': start_date}
        if project_id:
            incident_filters['project_id'] = project_id

        total_incident_count = Incident.objects.filter(**incident_filters).count()

        cache_hit_rate = 0.0
        total_requests = overall_stats['total_requests'] or 0
        if total_incident_count > 0 and total_requests > 0:
            cache_hit_rate = max(0, ((total_incident_count - total_requests) / total_incident_count) * 100)

        # Optimization recommendations
        recommendations = []
        avg_cost = float(overall_stats['avg_cost_per_request'] or 0)

        if avg_cost > 0.01:
            recommendations.append({
                "type": "high_cost_per_request",
                "message": f"Average cost per request (${avg_cost:.4f}) is high. Consider prompt optimization.",
                "priority": "high"
            })

        if cache_hit_rate < 80 and total_requests > 10:
            recommendations.append({
                "type": "low_cache_hit_rate",
                "message": f"Cache hit rate ({cache_hit_rate:.1f}%) is low. Most requests are generating new AI calls.",
                "priority": "medium"
            })

        if total_requests > total_incident_count * 2:
            recommendations.append({
                "type": "duplicate_requests",
                "message": "Detected multiple AI requests per incident. Consider implementing batching.",
                "priority": "high"
            })

        return {
            "time_period_days": days,
            "overall_stats": {
                "total_requests": total_requests,
                "total_cost_usd": float(overall_stats['total_cost'] or 0),
                "total_tokens": overall_stats['total_tokens'] or 0,
                "avg_cost_per_request": float(avg_cost)
            },
            "cache_stats": {
                "total_incidents": total_incident_count,
                "cache_hit_rate": cache_hit_rate,
                "potential_savings": float(overall_stats['total_cost'] or 0) * (cache_hit_rate / 100)
            },
            "most_expensive_incidents": expensive_incidents,
            "recommendations": recommendations
        }

    return await get_cost_summary_data()
