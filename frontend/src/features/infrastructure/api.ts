import api from '../../services/api'
import type { HostDetail, HostListItem } from './types'

export async function fetchHosts(): Promise<HostListItem[]> {
  const { data } = await api.get<HostListItem[]>('/api/v1/infrastructure/hosts')
  return data ?? []
}

export async function fetchHostDetail(hostname: string): Promise<HostDetail> {
  const { data } = await api.get<HostDetail>(`/api/v1/infrastructure/hosts/${hostname}`)
  return data as HostDetail
}
