export interface TraceSummary {
  trace_id: string
  duration_ms: number
  service_count: number
  span_count: number
}

export type TracingSortKey = 'duration' | 'spanCount' | 'serviceCount'
export type TracingSortOrder = 'asc' | 'desc'

export interface ApiSpan {
  trace_id: string
  span_id: string
  parent_span_id?: string | null
  service_name: string
  operation: string
  duration_ms: number
  status: string
  attributes?: Record<string, unknown>
  events?: Array<{ name: string; timestamp?: number }>
  timestamp?: string
}

export interface TraceResponse {
  trace_id: string
  spans: ApiSpan[]
  total_duration_ms: number
  waterfall?: ApiSpan[]
}

export interface TracesListParams {
  limit?: number
  service?: string
  min_duration?: number
  max_duration?: number
  status?: string
}
