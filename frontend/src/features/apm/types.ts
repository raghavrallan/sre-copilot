/** Service card on APM overview (list page). */
export interface APMService {
  id: string
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
  sparkline: number[]
}

/** Raw row from GET /api/v1/metrics/services-overview */
export interface ServicesOverviewResponse {
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
  sparkline: number[]
}

/** Single transaction from metrics API */
export interface TransactionApi {
  transaction_id: string
  service_name: string
  endpoint: string
  method: string
  status_code: number
  duration_ms: number
  db_duration_ms?: number
  external_duration_ms?: number
  timestamp: string
  error?: string
}

export interface OverviewResponse {
  service_name: string
  throughput_rpm: number
  avg_response_time_ms: number
  error_rate_percent: number
  apdex: number
  total_transactions: number
}

export interface TransactionsResponse {
  service_name: string
  transactions: TransactionApi[]
  p50_ms: number
  p95_ms: number
  p99_ms: number
  total_count: number
}

export interface DatabaseQueriesResponse {
  service_name: string
  query_count: number
  avg_query_time_ms: number
  total_db_time_ms: number
  p95_db_time_ms: number
}

export interface ExternalServicesResponse {
  service_name: string
  call_count: number
  avg_external_time_ms: number
  total_external_time_ms: number
  p95_external_time_ms: number
}

export type APMServiceDetailTabId = 'overview' | 'transactions' | 'database' | 'external'
