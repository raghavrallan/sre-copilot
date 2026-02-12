"""
Audit Service - Comprehensive audit logging and compliance
"""
from fastapi import FastAPI, HTTPException, Depends, Query

from shared.utils.internal_auth import verify_internal_auth
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import json

app = FastAPI(
    title="Audit Service",
    description="Comprehensive audit logging for compliance and security",
    version="2.0.0"
)

# In-memory audit log storage (use database in production)
audit_logs = []


class AuditLog(BaseModel):
    """Audit log entry"""
    id: Optional[str] = None
    timestamp: str
    user_id: str
    user_email: str
    tenant_id: str
    action: str  # e.g., "incident.create", "incident.update", "user.login"
    resource_type: str  # e.g., "incident", "user", "hypothesis"
    resource_id: Optional[str] = None
    changes: Optional[dict] = None  # {"before": {...}, "after": {...}}
    ip_address: str
    user_agent: str
    request_id: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None
    metadata: Optional[dict] = None


class AuditLogCreate(BaseModel):
    """Create audit log request"""
    user_id: str
    user_email: str
    tenant_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    changes: Optional[dict] = None
    ip_address: str
    user_agent: str
    request_id: Optional[str] = None
    success: bool = True
    error_message: Optional[str] = None
    metadata: Optional[dict] = None


class AuditLogFilter(BaseModel):
    """Filter criteria for audit logs"""
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    action: Optional[str] = None
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    success: Optional[bool] = None
    skip: int = 0
    limit: int = 100


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "audit-service",
        "total_logs": len(audit_logs),
        "timestamp": datetime.utcnow().isoformat()
    }


@app.post("/audit-logs", response_model=AuditLog)
async def create_audit_log(log: AuditLogCreate, _auth: bool = Depends(verify_internal_auth)):
    """
    Create a new audit log entry

    All API calls should be logged here for compliance
    """
    import uuid

    audit_log = AuditLog(
        id=str(uuid.uuid4()),
        timestamp=datetime.utcnow().isoformat(),
        **log.dict()
    )

    audit_logs.append(audit_log.dict())

    return audit_log


@app.get("/audit-logs", response_model=List[dict])
async def get_audit_logs(
    _auth: bool = Depends(verify_internal_auth),
    tenant_id: str = Query(..., description="Tenant ID for filtering"),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    success: Optional[bool] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """
    Retrieve audit logs with filtering

    Supports filtering by tenant, user, action, resource, date range, etc.
    """
    filtered_logs = audit_logs.copy()

    # Filter by tenant (required for multi-tenancy)
    filtered_logs = [log for log in filtered_logs if log.get("tenant_id") == tenant_id]

    # Apply optional filters
    if user_id:
        filtered_logs = [log for log in filtered_logs if log.get("user_id") == user_id]

    if action:
        filtered_logs = [log for log in filtered_logs if log.get("action") == action]

    if resource_type:
        filtered_logs = [log for log in filtered_logs if log.get("resource_type") == resource_type]

    if resource_id:
        filtered_logs = [log for log in filtered_logs if log.get("resource_id") == resource_id]

    if success is not None:
        filtered_logs = [log for log in filtered_logs if log.get("success") == success]

    if start_date:
        start = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
        filtered_logs = [
            log for log in filtered_logs
            if datetime.fromisoformat(log.get("timestamp", "").replace('Z', '+00:00')) >= start
        ]

    if end_date:
        end = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
        filtered_logs = [
            log for log in filtered_logs
            if datetime.fromisoformat(log.get("timestamp", "").replace('Z', '+00:00')) <= end
        ]

    # Sort by timestamp descending
    filtered_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # Pagination
    total = len(filtered_logs)
    paginated_logs = filtered_logs[skip:skip + limit]

    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "logs": paginated_logs
    }


@app.get("/audit-logs/{log_id}")
async def get_audit_log(log_id: str, tenant_id: str = Query(...), _auth: bool = Depends(verify_internal_auth)):
    """Get specific audit log by ID"""
    log = next((log for log in audit_logs if log.get("id") == log_id and log.get("tenant_id") == tenant_id), None)

    if not log:
        raise HTTPException(status_code=404, detail="Audit log not found")

    return log


@app.get("/audit-logs/user/{user_id}/activity")
async def get_user_activity(
    user_id: str,
    tenant_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth),
    limit: int = Query(50, ge=1, le=500)
):
    """Get recent activity for a specific user"""
    user_logs = [
        log for log in audit_logs
        if log.get("user_id") == user_id and log.get("tenant_id") == tenant_id
    ]

    # Sort by timestamp
    user_logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    return {
        "user_id": user_id,
        "total_activities": len(user_logs),
        "recent_activities": user_logs[:limit]
    }


@app.get("/audit-logs/resource/{resource_type}/{resource_id}/history")
async def get_resource_history(
    resource_type: str,
    resource_id: str,
    tenant_id: str = Query(...),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get complete history for a specific resource"""
    resource_logs = [
        log for log in audit_logs
        if (log.get("resource_type") == resource_type and
            log.get("resource_id") == resource_id and
            log.get("tenant_id") == tenant_id)
    ]

    # Sort chronologically
    resource_logs.sort(key=lambda x: x.get("timestamp", ""))

    return {
        "resource_type": resource_type,
        "resource_id": resource_id,
        "total_events": len(resource_logs),
        "history": resource_logs
    }


@app.get("/audit-logs/stats")
async def get_audit_stats(
    tenant_id: str = Query(...),
    days: int = Query(7, ge=1, le=90),
    _auth: bool = Depends(verify_internal_auth)
):
    """Get audit statistics for the tenant"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)

    tenant_logs = [
        log for log in audit_logs
        if (log.get("tenant_id") == tenant_id and
            datetime.fromisoformat(log.get("timestamp", "").replace('Z', '+00:00')) >= cutoff_date)
    ]

    # Calculate statistics
    total_events = len(tenant_logs)
    successful_events = sum(1 for log in tenant_logs if log.get("success"))
    failed_events = total_events - successful_events

    # Count by action
    action_counts = {}
    for log in tenant_logs:
        action = log.get("action", "unknown")
        action_counts[action] = action_counts.get(action, 0) + 1

    # Count by user
    user_counts = {}
    for log in tenant_logs:
        user_id = log.get("user_id", "unknown")
        user_counts[user_id] = user_counts.get(user_id, 0) + 1

    # Count by resource type
    resource_counts = {}
    for log in tenant_logs:
        resource_type = log.get("resource_type", "unknown")
        resource_counts[resource_type] = resource_counts.get(resource_type, 0) + 1

    return {
        "period_days": days,
        "total_events": total_events,
        "successful_events": successful_events,
        "failed_events": failed_events,
        "success_rate": f"{(successful_events / total_events * 100) if total_events > 0 else 0:.2f}%",
        "top_actions": sorted(action_counts.items(), key=lambda x: x[1], reverse=True)[:10],
        "top_users": sorted(user_counts.items(), key=lambda x: x[1], reverse=True)[:10],
        "resource_breakdown": resource_counts
    }


@app.delete("/audit-logs/cleanup")
async def cleanup_old_logs(
    tenant_id: str = Query(...),
    days_to_keep: int = Query(365, ge=30, le=3650),
    _auth: bool = Depends(verify_internal_auth)
):
    """
    Cleanup audit logs older than specified days

    Minimum: 30 days, Maximum: 10 years (3650 days)
    """
    global audit_logs

    cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)

    # Count logs before cleanup
    initial_count = len([log for log in audit_logs if log.get("tenant_id") == tenant_id])

    # Remove old logs
    audit_logs = [
        log for log in audit_logs
        if not (log.get("tenant_id") == tenant_id and
                datetime.fromisoformat(log.get("timestamp", "").replace('Z', '+00:00')) < cutoff_date)
    ]

    # Count logs after cleanup
    final_count = len([log for log in audit_logs if log.get("tenant_id") == tenant_id])
    removed_count = initial_count - final_count

    return {
        "message": f"Cleaned up {removed_count} audit logs older than {days_to_keep} days",
        "removed_count": removed_count,
        "remaining_count": final_count
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8008)
