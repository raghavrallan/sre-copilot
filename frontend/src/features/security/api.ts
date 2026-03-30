import api from '../../services/api'
import type { SecurityOverviewApi, VulnerabilityApi } from './types'

export async function fetchVulnerabilities(
  projectId: string,
  params?: { severity?: string; service?: string; status?: string }
): Promise<VulnerabilityApi[]> {
  const { data } = await api.get<VulnerabilityApi[]>('/api/v1/security/vulnerabilities', {
    params: {
      project_id: projectId,
      ...params,
    },
  })
  return data ?? []
}

export async function fetchVulnerabilitiesOverview(
  projectId: string
): Promise<SecurityOverviewApi | null> {
  const { data } = await api.get<SecurityOverviewApi>('/api/v1/security/vulnerabilities/overview', {
    params: { project_id: projectId },
  })
  return data ?? null
}

export async function patchVulnerabilityStatus(
  projectId: string,
  vulnId: string,
  status: string
): Promise<void> {
  await api.patch(`/api/v1/security/vulnerabilities/${vulnId}`, { status }, {
    params: { project_id: projectId },
  })
}
