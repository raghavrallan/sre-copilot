import api from '../../services/api'
import type {
  CreateSLOApiPayload,
  GrafanaDashboardDetailResponse,
  GrafanaDashboardsApiResponse,
  GrafanaSloQueryBody,
  SLOApi,
  SloLiveComplianceResult,
} from './types'

export async function fetchSlos(): Promise<SLOApi[]> {
  const { data } = await api.get<SLOApi[]>('/api/v1/slos')
  return data ?? []
}

export async function createSlo(body: CreateSLOApiPayload): Promise<SLOApi> {
  const { data } = await api.post<SLOApi>('/api/v1/slos', body)
  return data
}

export async function postGrafanaSloQuery(body: GrafanaSloQueryBody): Promise<SloLiveComplianceResult> {
  const { data } = await api.post<SloLiveComplianceResult>('/api/v1/grafana/slo-query', body)
  return data
}

export async function fetchGrafanaDashboards(): Promise<GrafanaDashboardsApiResponse> {
  const { data } = await api.get<GrafanaDashboardsApiResponse>('/api/v1/grafana/dashboards')
  return data
}

export async function fetchGrafanaDashboard(uid: string): Promise<GrafanaDashboardDetailResponse> {
  const { data } = await api.get<GrafanaDashboardDetailResponse>(`/api/v1/grafana/dashboards/${uid}`)
  return data
}
