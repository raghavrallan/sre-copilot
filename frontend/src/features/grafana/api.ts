import api from '../../services/api'
import type {
  AnalysisResult,
  DashboardDetail,
  GrafanaCreateIncidentRequest,
  GrafanaResponse,
  QueryPanelRequest,
  QueryPanelResponse,
} from './types'

export async function fetchGrafanaDashboards(): Promise<GrafanaResponse> {
  const { data } = await api.get<GrafanaResponse>('/api/v1/grafana/dashboards')
  return data
}

export async function fetchGrafanaDashboard(uid: string): Promise<DashboardDetail> {
  const { data } = await api.get<DashboardDetail>(`/api/v1/grafana/dashboards/${uid}`)
  return data
}

export async function queryGrafanaPanel(body: QueryPanelRequest): Promise<QueryPanelResponse> {
  const { data } = await api.post<QueryPanelResponse>('/api/v1/grafana/query-panel', body)
  return data
}

export async function analyzeGrafanaDashboard(dashboardUid: string): Promise<AnalysisResult> {
  const { data } = await api.post<AnalysisResult>('/api/v1/grafana/analyze', {
    dashboard_uid: dashboardUid,
  })
  return data
}

export async function createGrafanaIncident(body: GrafanaCreateIncidentRequest): Promise<unknown> {
  const { data } = await api.post('/api/v1/grafana/create-incident', body)
  return data
}
