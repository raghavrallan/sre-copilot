import api from '../../services/api'
import type { DeploymentApi } from './types'

export async function fetchDeployments(params?: { limit?: number }): Promise<DeploymentApi[]> {
  const { data } = await api.get<DeploymentApi[]>('/api/v1/deployments', {
    params: { limit: params?.limit ?? 100 },
  })
  return data ?? []
}
