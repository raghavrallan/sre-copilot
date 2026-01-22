"""
Webhook payload models for AlertManager and Grafana
"""
from pydantic import BaseModel, Field
from typing import List, Dict, Optional
from datetime import datetime


class AlertManagerLabel(BaseModel):
    """AlertManager alert labels"""
    alertname: str
    severity: str
    service: Optional[str] = "unknown"
    instance: Optional[str] = None


class AlertManagerAnnotation(BaseModel):
    """AlertManager alert annotations"""
    summary: str
    description: Optional[str] = ""


class AlertManagerAlert(BaseModel):
    """Individual alert in AlertManager webhook"""
    status: str  # firing, resolved
    labels: AlertManagerLabel
    annotations: AlertManagerAnnotation
    startsAt: str
    endsAt: Optional[str] = None
    generatorURL: Optional[str] = None
    fingerprint: str


class AlertManagerWebhook(BaseModel):
    """AlertManager webhook payload"""
    version: str
    groupKey: str
    status: str  # firing, resolved
    receiver: str
    groupLabels: Dict[str, str]
    commonLabels: Dict[str, str]
    commonAnnotations: Dict[str, str]
    externalURL: str
    alerts: List[AlertManagerAlert]


class GrafanaAlert(BaseModel):
    """Grafana alert data"""
    uid: str
    title: str
    state: str  # alerting, ok, noData
    message: Optional[str] = ""


class GrafanaWebhook(BaseModel):
    """Grafana webhook payload"""
    alerts: List[GrafanaAlert]
    title: str
    state: str
    message: Optional[str] = ""
    dashboardId: Optional[int] = None
    panelId: Optional[int] = None
    orgId: Optional[int] = None
