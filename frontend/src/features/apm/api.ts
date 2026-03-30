import api from '../../services/api'
import type {
  APMService,
  DatabaseQueriesResponse,
  ExternalServicesResponse,
  OverviewResponse,
  ServicesOverviewResponse,
  TransactionApi,
  TransactionsResponse,
} from './types'

export async function fetchServicesOverview(): Promise<ServicesOverviewResponse[]> {
  const { data } = await api.get<ServicesOverviewResponse[]>('/api/v1/metrics/services-overview')
  return Array.isArray(data) ? data : []
}

export function mapOverviewToAPMService(s: ServicesOverviewResponse): APMService {
  return {
    id: s.name,
    name: s.name,
    throughput: s.throughput ?? 0,
    avgResponseTime: s.avgResponseTime ?? 0,
    errorRate: s.errorRate ?? 0,
    sparkline: Array.isArray(s.sparkline) ? s.sparkline : [],
  }
}

export async function fetchServiceOverview(serviceName: string): Promise<OverviewResponse> {
  const { data } = await api.get<OverviewResponse>(
    `/api/v1/metrics/services/${encodeURIComponent(serviceName)}/overview`
  )
  return data
}

export async function fetchServiceTransactions(serviceName: string): Promise<TransactionsResponse> {
  const { data } = await api.get<TransactionsResponse>(
    `/api/v1/metrics/services/${encodeURIComponent(serviceName)}/transactions`
  )
  return data
}

export async function fetchSlowTransactions(serviceName: string): Promise<TransactionApi[]> {
  const { data } = await api.get<TransactionApi[]>(
    `/api/v1/metrics/services/${encodeURIComponent(serviceName)}/slow-transactions`
  )
  return Array.isArray(data) ? data : []
}

export async function fetchDatabaseQueries(serviceName: string): Promise<DatabaseQueriesResponse> {
  const { data } = await api.get<DatabaseQueriesResponse>(
    `/api/v1/metrics/services/${encodeURIComponent(serviceName)}/database-queries`
  )
  return data
}

export async function fetchExternalServicesMetrics(
  serviceName: string
): Promise<ExternalServicesResponse> {
  const { data } = await api.get<ExternalServicesResponse>(
    `/api/v1/metrics/services/${encodeURIComponent(serviceName)}/external-services`
  )
  return data
}
