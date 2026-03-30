import api from '../../services/api'
import type { Incident, Hypothesis, ActivityItem, CreateIncidentRequest } from './types'

export interface IncidentListResponse {
  items: Incident[]
  total: number
  pages: number
}

export async function fetchIncidents(params: {
  page: number
  limit: number
  severity?: string
  state?: string
  search?: string
}): Promise<IncidentListResponse> {
  const searchParams = new URLSearchParams({
    page: params.page.toString(),
    limit: params.limit.toString(),
  })
  if (params.severity) searchParams.append('severity', params.severity)
  if (params.state) searchParams.append('state', params.state)
  if (params.search) searchParams.append('search', params.search)

  const { data } = await api.get(`/api/v1/incidents?${searchParams.toString()}`)
  return data
}

export async function createIncident(body: CreateIncidentRequest): Promise<Incident> {
  const { data } = await api.post('/api/v1/incidents', body)
  return data
}

export async function getIncident(id: string, projectId?: string): Promise<Incident> {
  const params = projectId ? `?project_id=${projectId}` : ''
  const { data } = await api.get(`/api/v1/incidents/${id}${params}`)
  return data
}

export async function getHypotheses(id: string, projectId?: string): Promise<Hypothesis[]> {
  const params = projectId ? `?project_id=${projectId}` : ''
  const { data } = await api.get(`/api/v1/incidents/${id}/hypotheses${params}`)
  return data
}

export async function getActivities(id: string, projectId?: string): Promise<ActivityItem[]> {
  const params = projectId ? `?project_id=${projectId}` : ''
  const { data } = await api.get(`/api/v1/incidents/${id}/activities${params}`)
  return data
}

export async function updateState(
  id: string,
  projectId: string | undefined,
  body: { state: string; comment?: string | null; user_id?: string; user_name?: string; user_email?: string }
): Promise<void> {
  await api.patch(`/api/v1/incidents/${id}/state?project_id=${projectId}`, body)
}

export async function updateSeverity(
  id: string,
  projectId: string | undefined,
  body: { severity: string; comment?: string | null; user_id?: string; user_name?: string; user_email?: string }
): Promise<void> {
  await api.patch(`/api/v1/incidents/${id}/severity?project_id=${projectId}`, body)
}

export async function addComment(
  id: string,
  projectId: string | undefined,
  body: { content: string; user_id?: string; user_name?: string; user_email?: string }
): Promise<void> {
  await api.post(`/api/v1/incidents/${id}/comments?project_id=${projectId}`, body)
}

export async function fetchGrafanaDashboards(): Promise<any[]> {
  const { data } = await api.get('/api/v1/grafana/dashboards')
  return (data.dashboards || []).filter((d: any) => d.uid)
}

export async function detectAnomalies(dashboardUid: string): Promise<any[]> {
  const { data } = await api.post('/api/v1/grafana/detect-anomalies', { dashboard_uid: dashboardUid, sensitivity: 2.0 })
  return data.anomalies || []
}

export async function createIncidentFromAnomaly(anomaly: any, dashboardUid: string): Promise<void> {
  await api.post('/api/v1/grafana/create-incident', {
    metric_name: anomaly.metric_name,
    expr: anomaly.expr,
    panel_title: anomaly.panel_title,
    dashboard_uid: dashboardUid,
    panel_id: anomaly.panel_id,
    severity: anomaly.max_severity === 'critical' ? 'critical' : 'high',
    latest_value: anomaly.latest_value,
    expected_value: anomaly.expected_value,
  })
}
