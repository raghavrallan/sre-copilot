"""
Dummy analytics endpoints for demonstration (no database required)
"""
from fastapi import APIRouter, Query
from typing import Optional
from datetime import datetime, timedelta
import random

router = APIRouter()


@router.get("/analytics/token-usage")
async def get_token_usage_dummy(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    incident_id: Optional[str] = Query(None)
):
    """
    Get token usage statistics (DUMMY DATA for demo)
    """

    # Generate realistic dummy data
    total_requests = random.randint(50, 150)
    total_input = random.randint(10000, 50000)
    total_output = random.randint(30000, 150000)

    return {
        "total_requests": total_requests,
        "total_input_tokens": total_input,
        "total_output_tokens": total_output,
        "total_tokens": total_input + total_output,
        "total_cost_usd": (total_input * 0.150 / 1_000_000) + (total_output * 0.600 / 1_000_000),
        "avg_duration_ms": random.randint(2000, 5000),
        "breakdown_by_type": [
            {
                "request_type": "hypothesis",
                "count": total_requests - 10,
                "input_tokens": total_input - 2000,
                "output_tokens": total_output - 10000,
                "total_tokens": (total_input - 2000) + (total_output - 10000),
                "cost_usd": ((total_input - 2000) * 0.150 / 1_000_000) + ((total_output - 10000) * 0.600 / 1_000_000)
            },
            {
                "request_type": "hypothesis_batch",
                "count": 5,
                "input_tokens": 1000,
                "output_tokens": 5000,
                "total_tokens": 6000,
                "cost_usd": (1000 * 0.150 / 1_000_000) + (5000 * 0.600 / 1_000_000)
            },
            {
                "request_type": "log_analysis",
                "count": 5,
                "input_tokens": 1000,
                "output_tokens": 5000,
                "total_tokens": 6000,
                "cost_usd": (1000 * 0.150 / 1_000_000) + (5000 * 0.600 / 1_000_000)
            }
        ],
        "timeline": [
            {
                "date": (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d"),
                "requests": random.randint(10, 30),
                "cost_usd": random.uniform(0.01, 0.05)
            }
            for i in range(7, 0, -1)
        ]
    }


@router.get("/analytics/incident-metrics/{incident_id}")
async def get_incident_metrics_dummy(incident_id: str):
    """
    Get detailed metrics for a specific incident (DUMMY DATA)
    """

    num_requests = random.randint(1, 3)

    return {
        "incident_id": incident_id,
        "incident_title": "Sample Incident - High CPU Usage",
        "summary": {
            "total_requests": num_requests,
            "total_tokens": random.randint(500, 1500),
            "total_cost_usd": random.uniform(0.0005, 0.0015)
        },
        "ai_requests": [
            {
                "id": f"req-{i}",
                "request_type": "hypothesis" if i == 0 else "log_analysis",
                "input_tokens": random.randint(150, 250),
                "output_tokens": random.randint(400, 800),
                "total_tokens": random.randint(550, 1050),
                "cost_usd": random.uniform(0.0004, 0.0008),
                "duration_ms": random.randint(2000, 5000),
                "model_used": "gpt-4o-mini",
                "success": True,
                "created_at": (datetime.now() - timedelta(minutes=i*5)).isoformat()
            }
            for i in range(num_requests)
        ],
        "analysis_steps": []
    }


@router.get("/analytics/cost-summary")
async def get_cost_summary_dummy(days: int = Query(7)):
    """
    Get overall cost summary (DUMMY DATA)
    """

    total_requests = random.randint(80, 200)
    total_cost = random.uniform(0.08, 0.25)
    total_incidents = random.randint(100, 300)
    cache_hit_rate = random.uniform(75, 95)

    return {
        "time_period_days": days,
        "overall_stats": {
            "total_requests": total_requests,
            "total_cost_usd": total_cost,
            "total_tokens": random.randint(80000, 200000),
            "avg_cost_per_request": total_cost / total_requests
        },
        "cache_stats": {
            "total_incidents": total_incidents,
            "cache_hit_rate": cache_hit_rate,
            "potential_savings": total_cost * (cache_hit_rate / 100)
        },
        "most_expensive_incidents": [
            {
                "incident_id": f"inc-{i}",
                "incident_title": f"High CPU on payment-service-{i}",
                "total_cost_usd": random.uniform(0.005, 0.02),
                "total_requests": random.randint(2, 5)
            }
            for i in range(1, 6)
        ],
        "recommendations": []
    }

    # Add recommendations based on metrics
    if cache_hit_rate < 80:
        return_data = {**get_cost_summary_dummy.__wrapped__(days)}
        return_data["recommendations"].append({
            "type": "low_cache_hit_rate",
            "message": f"Cache hit rate ({cache_hit_rate:.1f}%) is below 80%. Consider increasing cache TTL or investigating cache invalidation patterns.",
            "priority": "medium"
        })

    if total_cost / total_requests > 0.002:
        if "recommendations" not in locals():
            return_data = {**get_cost_summary_dummy.__wrapped__(days)}
        return_data["recommendations"].append({
            "type": "high_cost_per_request",
            "message": f"Average cost per request (${total_cost/total_requests:.4f}) is high. Consider prompt optimization or batch processing.",
            "priority": "high"
        })

    result = {
        "time_period_days": days,
        "overall_stats": {
            "total_requests": total_requests,
            "total_cost_usd": total_cost,
            "total_tokens": random.randint(80000, 200000),
            "avg_cost_per_request": total_cost / total_requests
        },
        "cache_stats": {
            "total_incidents": total_incidents,
            "cache_hit_rate": cache_hit_rate,
            "potential_savings": total_cost * (cache_hit_rate / 100)
        },
        "most_expensive_incidents": [
            {
                "incident_id": f"inc-{i}",
                "incident_title": f"High CPU on payment-service-{i}",
                "total_cost_usd": random.uniform(0.005, 0.02),
                "total_requests": random.randint(2, 5)
            }
            for i in range(1, 6)
        ],
        "recommendations": []
    }

    # Add recommendations
    if cache_hit_rate < 80:
        result["recommendations"].append({
            "type": "low_cache_hit_rate",
            "message": f"Cache hit rate ({cache_hit_rate:.1f}%) is below 80%. Consider increasing cache TTL.",
            "priority": "medium"
        })

    if total_cost / total_requests > 0.002:
        result["recommendations"].append({
            "type": "high_cost_per_request",
            "message": f"Average cost per request (${total_cost/total_requests:.4f}) is high. Consider prompt optimization.",
            "priority": "high"
        })

    if cache_hit_rate >= 85:
        result["recommendations"].append({
            "type": "good_cache_performance",
            "message": f"Excellent cache hit rate ({cache_hit_rate:.1f}%)! Your caching strategy is working well.",
            "priority": "low"
        })

    return result
