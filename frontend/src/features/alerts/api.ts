import api from '../../services/api'
import type {
  ActiveAlert,
  Channel,
  Condition,
  GrafanaAlertRulesResponse,
  GrafanaCreateIncidentRequest,
  MutingRule,
  Policy,
} from './types'

export async function fetchActiveAlerts(projectId: string): Promise<ActiveAlert[]> {
  const { data } = await api.get('/api/v1/alerts/active-alerts', { params: { project_id: projectId } })
  return data.alerts ?? data ?? []
}

export async function fetchGrafanaAlertRules(): Promise<GrafanaAlertRulesResponse> {
  const { data } = await api.get('/api/v1/grafana/alert-rules')
  return { rules: data?.rules ?? [], grafana_url: data?.grafana_url }
}

export async function createGrafanaIncident(body: GrafanaCreateIncidentRequest): Promise<void> {
  await api.post('/api/v1/grafana/create-incident', body)
}

export async function fetchConditions(projectId: string): Promise<Condition[]> {
  const { data } = await api.get('/api/v1/alerts/conditions', { params: { project_id: projectId } })
  return data.conditions ?? data ?? []
}

export async function fetchPolicies(projectId: string): Promise<Policy[]> {
  const { data } = await api.get('/api/v1/alerts/policies', { params: { project_id: projectId } })
  return data.policies ?? data ?? []
}

export async function fetchChannels(projectId: string): Promise<Channel[]> {
  const { data } = await api.get('/api/v1/alerts/channels', { params: { project_id: projectId } })
  return data.channels ?? data ?? []
}

export async function fetchMutingRules(projectId: string): Promise<MutingRule[]> {
  const { data } = await api.get('/api/v1/alerts/muting-rules', { params: { project_id: projectId } })
  return data.rules ?? data ?? []
}
