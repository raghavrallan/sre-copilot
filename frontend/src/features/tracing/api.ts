import api from '../../services/api'
import type { TraceResponse, TraceSummary, TracesListParams } from './types'

export async function fetchMetricsServices(): Promise<string[]> {
  const { data } = await api.get<string[]>('/api/v1/metrics/services')
  return data ?? []
}

export async function fetchTraces(params: TracesListParams): Promise<TraceSummary[]> {
  const { data } = await api.get<TraceSummary[]>('/api/v1/traces', { params })
  return data ?? []
}

export async function fetchTrace(traceId: string): Promise<TraceResponse> {
  const { data } = await api.get<TraceResponse>(`/api/v1/traces/${traceId}`)
  return data
}
