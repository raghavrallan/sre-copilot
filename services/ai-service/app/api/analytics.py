"""
Analytics endpoints for AI service cost monitoring

IMPORTANT: All endpoints require project_id for multi-tenancy isolation.
The API Gateway passes project_id from the authenticated user's JWT token.
"""
from fastapi import APIRouter, Query, HTTPException
from typing import Optional
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from django.db.models.functions import TruncDate
from asgiref.sync import sync_to_async

from shared.models.ai_request import AIRequest
from shared.models.analysis_step import AnalysisStep
from shared.models.incident import Incident

router = APIRouter()


@router.get("/analytics/token-usage")
async def get_token_usage(
    project_id: str = Query(..., description="Project ID (required for isolation)"),
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    incident_id: Optional[str] = Query(None, description="Filter by incident ID")
):
    """
    Get token usage statistics for a specific project.

    SECURITY: Filters all data by project_id to ensure tenant isolation.
    """
    @sync_to_async
    def get_token_usage_data():
        # REQUIRED: Filter by project_id for multi-tenancy
        filters = {'incident__project_id': project_id}

        if incident_id:
            # Verify incident belongs to this project
            if not Incident.objects.filter(id=incident_id, project_id=project_id).exists():
                raise HTTPException(status_code=404, detail="Incident not found in this project")
            filters['incident_id'] = incident_id

        # Default to last 7 days if no dates provided
        if start_date:
            start_dt = timezone.make_aware(datetime.strptime(start_date, "%Y-%m-%d"))
        else:
            start_dt = timezone.now() - timedelta(days=7)
        filters['created_at__gte'] = start_dt

        if end_date:
            end_dt = timezone.make_aware(datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1))
            filters['created_at__lt'] = end_dt

        # Get AI requests filtered by project
        ai_requests = AIRequest.objects.filter(**filters)

        # Aggregate totals in single query
        aggregates = ai_requests.aggregate(
            total_requests=Count('id'),
            total_input=Sum('input_tokens'),
            total_output=Sum('output_tokens'),
            total_cost=Sum('cost_usd'),
            avg_duration=Avg('duration_ms')
        )

        total_requests = aggregates['total_requests'] or 0

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

        # Efficient breakdown by request type
        breakdown = list(
            ai_requests.values('request_type')
            .annotate(
                count=Count('id'),
                input_tokens=Sum('input_tokens'),
                output_tokens=Sum('output_tokens'),
                cost_usd=Sum('cost_usd')
            )
            .order_by('-cost_usd')
        )

        formatted_breakdown = [{
            "request_type": item['request_type'],
            "count": item['count'],
            "input_tokens": item['input_tokens'] or 0,
            "output_tokens": item['output_tokens'] or 0,
            "total_tokens": (item['input_tokens'] or 0) + (item['output_tokens'] or 0),
            "cost_usd": float(item['cost_usd'] or 0)
        } for item in breakdown]

        # Efficient timeline using TruncDate
        timeline_data = list(
            ai_requests
            .annotate(date=TruncDate('created_at'))
            .values('date')
            .annotate(
                requests=Count('id'),
                cost_usd=Sum('cost_usd')
            )
            .order_by('date')
        )

        timeline = [{
            "date": item['date'].strftime("%Y-%m-%d") if item['date'] else None,
            "requests": item['requests'] or 0,
            "cost_usd": float(item['cost_usd'] or 0)
        } for item in timeline_data]

        return {
            "total_requests": total_requests,
            "total_input_tokens": aggregates['total_input'] or 0,
            "total_output_tokens": aggregates['total_output'] or 0,
            "total_tokens": (aggregates['total_input'] or 0) + (aggregates['total_output'] or 0),
            "total_cost_usd": float(aggregates['total_cost'] or 0),
            "avg_duration_ms": int(aggregates['avg_duration'] or 0),
            "breakdown_by_type": formatted_breakdown,
            "timeline": timeline
        }

    return await get_token_usage_data()


@router.get("/analytics/incident-metrics/{incident_id}")
async def get_incident_metrics(
    incident_id: str,
    project_id: str = Query(..., description="Project ID (required for isolation)")
):
    """
    Get detailed metrics for a specific incident.

    SECURITY: Validates incident belongs to the specified project.
    """
    @sync_to_async
    def get_incident_metrics_data():
        # SECURITY: Verify incident exists AND belongs to this project
        try:
            incident = Incident.objects.get(id=incident_id, project_id=project_id)
        except Incident.DoesNotExist:
            raise HTTPException(
                status_code=404,
                detail="Incident not found or does not belong to this project"
            )

        # Get aggregates
        aggregates = AIRequest.objects.filter(incident_id=incident_id).aggregate(
            total_requests=Count('id'),
            total_tokens=Sum('total_tokens'),
            total_cost=Sum('cost_usd')
        )

        # Get AI requests
        ai_requests = list(
            AIRequest.objects.filter(incident_id=incident_id)
            .order_by('created_at')
            .values(
                'id', 'request_type', 'input_tokens', 'output_tokens',
                'total_tokens', 'cost_usd', 'duration_ms', 'model_used',
                'success', 'created_at'
            )
        )

        formatted_requests = [{
            "id": str(req['id']),
            "request_type": req['request_type'],
            "input_tokens": req['input_tokens'],
            "output_tokens": req['output_tokens'],
            "total_tokens": req['total_tokens'],
            "cost_usd": float(req['cost_usd']) if req['cost_usd'] else 0,
            "duration_ms": req['duration_ms'],
            "model_used": req['model_used'],
            "success": req['success'],
            "created_at": req['created_at'].isoformat() if req['created_at'] else None
        } for req in ai_requests]

        # Get analysis steps
        analysis_steps = list(
            AnalysisStep.objects.filter(incident_id=incident_id)
            .order_by('step_number')
            .values(
                'id', 'step_type', 'step_number', 'status', 'input_tokens',
                'output_tokens', 'total_tokens', 'cost_usd', 'duration_ms',
                'started_at', 'completed_at'
            )
        )

        formatted_steps = [{
            "id": str(step['id']),
            "step_type": step['step_type'],
            "step_number": step['step_number'],
            "status": step['status'],
            "input_tokens": step['input_tokens'],
            "output_tokens": step['output_tokens'],
            "total_tokens": step['total_tokens'],
            "cost_usd": float(step['cost_usd']) if step['cost_usd'] else None,
            "duration_ms": step['duration_ms'],
            "started_at": step['started_at'].isoformat() if step['started_at'] else None,
            "completed_at": step['completed_at'].isoformat() if step['completed_at'] else None
        } for step in analysis_steps]

        return {
            "incident_id": incident_id,
            "incident_title": incident.title,
            "summary": {
                "total_requests": aggregates['total_requests'] or 0,
                "total_tokens": aggregates['total_tokens'] or 0,
                "total_cost_usd": float(aggregates['total_cost'] or 0)
            },
            "ai_requests": formatted_requests,
            "analysis_steps": formatted_steps
        }

    return await get_incident_metrics_data()


@router.get("/analytics/cost-summary")
async def get_cost_summary(
    project_id: str = Query(..., description="Project ID (required for isolation)"),
    days: int = Query(7, description="Number of days to look back")
):
    """
    Get overall cost summary and statistics for a specific project.

    SECURITY: Filters all data by project_id to ensure tenant isolation.
    """
    @sync_to_async
    def get_cost_summary_data():
        start_date = timezone.now() - timedelta(days=days)

        # REQUIRED: Filter by project_id for multi-tenancy
        filters = {
            'created_at__gte': start_date,
            'incident__project_id': project_id
        }

        # Overall stats - filtered by project
        overall_stats = AIRequest.objects.filter(**filters).aggregate(
            total_requests=Count('id'),
            total_cost=Sum('cost_usd'),
            total_tokens=Sum('total_tokens'),
            avg_cost_per_request=Avg('cost_usd')
        )

        total_requests = overall_stats['total_requests'] or 0

        # Most expensive incidents - filtered by project
        expensive_incidents_data = list(
            AIRequest.objects.filter(**filters)
            .values('incident_id')
            .annotate(
                total_cost=Sum('cost_usd'),
                total_requests=Count('id')
            )
            .order_by('-total_cost')[:10]
        )

        # Get incident titles (already filtered by project through the join)
        incident_ids = [item['incident_id'] for item in expensive_incidents_data]
        incidents = {
            str(inc.id): inc.title
            for inc in Incident.objects.filter(id__in=incident_ids, project_id=project_id)
        }

        expensive_incidents = [{
            "incident_id": str(item['incident_id']),
            "incident_title": incidents.get(str(item['incident_id']), "Unknown"),
            "total_cost_usd": float(item['total_cost'] or 0),
            "total_requests": item['total_requests']
        } for item in expensive_incidents_data if str(item['incident_id']) in incidents]

        # Calculate cache effectiveness - filtered by project
        total_incident_count = Incident.objects.filter(
            created_at__gte=start_date,
            project_id=project_id
        ).count()

        cache_hit_rate = 0.0
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
                "avg_cost_per_request": avg_cost
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
