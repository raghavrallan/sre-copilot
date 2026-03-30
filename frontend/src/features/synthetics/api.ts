import api from '../../services/api'
import type {
  CreateSyntheticsMonitorPayload,
  MonitorApi,
  SyntheticsResultsResponse,
} from './types'

export async function fetchSyntheticsMonitors(projectId: string): Promise<MonitorApi[]> {
  const { data } = await api.get<MonitorApi[]>('/api/v1/synthetics/monitors', {
    params: { project_id: projectId },
  })
  return data ?? []
}

export async function fetchSyntheticsMonitorResults(
  projectId: string,
  monitorId: string
): Promise<SyntheticsResultsResponse> {
  const { data } = await api.get<SyntheticsResultsResponse>(
    `/api/v1/synthetics/monitors/${monitorId}/results`,
    { params: { project_id: projectId } }
  )
  return data ?? { items: [] }
}

export async function createSyntheticsMonitor(
  payload: CreateSyntheticsMonitorPayload
): Promise<MonitorApi> {
  const { data } = await api.post<MonitorApi>('/api/v1/synthetics/monitors', payload)
  return data
}
