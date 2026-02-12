import { useState, useEffect, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Activity, Clock, AlertTriangle, Database, Globe, RefreshCw } from 'lucide-react'
import ApdexGauge from '../components/apm/ApdexGauge'
import TransactionList, { Transaction } from '../components/apm/TransactionList'
import SlowQueries, { SlowQuery } from '../components/apm/SlowQueries'
import ExternalServices, { ExternalService } from '../components/apm/ExternalServices'
import api from '../services/api'

const TIME_RANGES = [
  { label: 'Last 30m', value: '30m' },
  { label: '1h', value: '1h' },
  { label: '3h', value: '3h' },
  { label: '6h', value: '6h' },
  { label: '12h', value: '12h' },
  { label: '24h', value: '24h' },
]

interface TransactionApi {
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

interface OverviewResponse {
  service_name: string
  throughput_rpm: number
  avg_response_time_ms: number
  error_rate_percent: number
  apdex: number
  total_transactions: number
}

interface TransactionsResponse {
  service_name: string
  transactions: TransactionApi[]
  p50_ms: number
  p95_ms: number
  p99_ms: number
  total_count: number
}

interface DatabaseQueriesResponse {
  service_name: string
  query_count: number
  avg_query_time_ms: number
  total_db_time_ms: number
  p95_db_time_ms: number
}

interface ExternalServicesResponse {
  service_name: string
  call_count: number
  avg_external_time_ms: number
  total_external_time_ms: number
  p95_external_time_ms: number
}

type TabId = 'overview' | 'transactions' | 'database' | 'external'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'transactions', label: 'Transactions', icon: Database },
  { id: 'database', label: 'Database', icon: Database },
  { id: 'external', label: 'External Services', icon: Globe },
]

function groupTransactionsByEndpoint(transactions: TransactionApi[]): Transaction[] {
  const groups = new Map<string, TransactionApi[]>()
  for (const t of transactions) {
    const key = `${t.endpoint}|${t.method}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(t)
  }
  const result: Transaction[] = []
  let idx = 0
  for (const [key, items] of groups) {
    const [endpoint, method] = key.split('|')
    const durations = items.map((i) => i.duration_ms)
    const sorted = [...durations].sort((a, b) => a - b)
    const p95Idx = Math.floor(sorted.length * 0.95)
    const p95 = sorted[p95Idx] ?? 0
    const errorCount = items.filter((i) => i.error || (i.status_code && i.status_code >= 400)).length
    result.push({
      id: `tx-${idx++}`,
      endpoint,
      method,
      avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length || 0,
      p95,
      throughput: items.length,
      errorRate: (errorCount / items.length) * 100 || 0,
      recentOccurrences: items.slice(0, 5).map((i) => ({
        timestamp: i.timestamp,
        duration: i.duration_ms,
        status: String(i.status_code ?? (i.error ? '500' : '200')),
      })),
    })
  }
  return result
}

function transactionsToTimeSeries(
  transactions: TransactionApi[],
  bucketMinutes: number = 15
): { time: string; p50: number; p95: number; p99: number; requests: number; rate: number }[] {
  if (transactions.length === 0) return []
  const buckets = new Map<number, TransactionApi[]>()
  const now = Date.now()
  const oneHour = 60 * 60 * 1000
  for (const t of transactions) {
    const ts = new Date(t.timestamp).getTime()
    if (now - ts > oneHour) continue
    const bucket = Math.floor(ts / (bucketMinutes * 60 * 1000)) * bucketMinutes * 60 * 1000
    if (!buckets.has(bucket)) buckets.set(bucket, [])
    buckets.get(bucket)!.push(t)
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucket, items]) => {
      const durations = items.map((i) => i.duration_ms).sort((a, b) => a - b)
      const p50Idx = Math.floor(durations.length * 0.5)
      const p95Idx = Math.floor(durations.length * 0.95)
      const p99Idx = Math.floor(durations.length * 0.99)
      const errors = items.filter((i) => i.error || (i.status_code && i.status_code >= 400)).length
      return {
        time: new Date(bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        p50: durations[p50Idx] ?? 0,
        p95: durations[p95Idx] ?? 0,
        p99: durations[p99Idx] ?? 0,
        requests: items.length,
        rate: (errors / items.length) * 100 || 0,
      }
    })
}

export default function APMServiceDetailPage() {
  const { serviceName } = useParams<{ serviceName: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [timeRange, setTimeRange] = useState('1h')

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(true)
  const [databaseLoading, setDatabaseLoading] = useState(true)
  const [externalLoading, setExternalLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [transactionsError, setTransactionsError] = useState<string | null>(null)
  const [databaseError, setDatabaseError] = useState<string | null>(null)
  const [externalError, setExternalError] = useState<string | null>(null)

  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [transactionsData, setTransactionsData] = useState<TransactionsResponse | null>(null)
  const [slowTransactions, setSlowTransactions] = useState<TransactionApi[]>([])
  const [databaseQueries, setDatabaseQueries] = useState<DatabaseQueriesResponse | null>(null)
  const [externalServices, setExternalServices] = useState<ExternalServicesResponse | null>(null)

  const displayName = serviceName ? decodeURIComponent(serviceName) : 'Unknown Service'

  useEffect(() => {
    if (!serviceName) return
    const sn = decodeURIComponent(serviceName)
    setOverviewLoading(true)
    setOverviewError(null)
    api
      .get<OverviewResponse>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/overview`)
      .then((r) => {
        setOverview(r.data)
      })
      .catch((err) => {
        setOverviewError(err instanceof Error ? err.message : 'Failed to load overview')
      })
      .finally(() => setOverviewLoading(false))
  }, [serviceName])

  useEffect(() => {
    if (!serviceName) return
    const sn = decodeURIComponent(serviceName)
    setTransactionsLoading(true)
    setTransactionsError(null)
    Promise.all([
      api.get<TransactionsResponse>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/transactions`),
      api.get<TransactionApi[]>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/slow-transactions`),
    ])
      .then(([txRes, slowRes]) => {
        setTransactionsData(txRes.data)
        setSlowTransactions(Array.isArray(slowRes.data) ? slowRes.data : [])
      })
      .catch((err) => {
        setTransactionsError(err instanceof Error ? err.message : 'Failed to load transactions')
      })
      .finally(() => setTransactionsLoading(false))
  }, [serviceName])

  useEffect(() => {
    if (!serviceName || activeTab !== 'database') return
    const sn = decodeURIComponent(serviceName)
    setDatabaseLoading(true)
    setDatabaseError(null)
    api
      .get<DatabaseQueriesResponse>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/database-queries`)
      .then((r) => setDatabaseQueries(r.data))
      .catch((err) => {
        setDatabaseError(err instanceof Error ? err.message : 'Failed to load database queries')
      })
      .finally(() => setDatabaseLoading(false))
  }, [serviceName, activeTab])

  useEffect(() => {
    if (!serviceName || activeTab !== 'external') return
    const sn = decodeURIComponent(serviceName)
    setExternalLoading(true)
    setExternalError(null)
    api
      .get<ExternalServicesResponse>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/external-services`)
      .then((r) => setExternalServices(r.data))
      .catch((err) => {
        setExternalError(err instanceof Error ? err.message : 'Failed to load external services')
      })
      .finally(() => setExternalLoading(false))
  }, [serviceName, activeTab])

  const transactions = useMemo(() => {
    const tx = transactionsData?.transactions ?? []
    return groupTransactionsByEndpoint(tx)
  }, [transactionsData])

  const chartData = useMemo(() => {
    const tx = transactionsData?.transactions ?? []
    return transactionsToTimeSeries(tx)
  }, [transactionsData])

  const slowQueries: SlowQuery[] = useMemo(() => {
    if (!databaseQueries) return []
    const d = databaseQueries
    return [
      {
        id: 'db-1',
        queryPattern: 'Database queries aggregate',
        avgDuration: d.avg_query_time_ms,
        callsPerMin: d.query_count,
        totalTime: d.total_db_time_ms,
      },
    ]
  }, [databaseQueries])

  const externalServicesList: ExternalService[] = useMemo(() => {
    if (!externalServices) return []
    const e = externalServices
    return [
      {
        id: 'ext-1',
        service: 'External calls',
        avgDuration: e.avg_external_time_ms,
        callsPerMin: e.call_count,
        errorRate: 0,
        status: 'healthy' as const,
      },
    ]
  }, [externalServices])

  const stats = useMemo(
    () => ({
      throughput: overview?.throughput_rpm ?? 0,
      avgResponseTime: overview?.avg_response_time_ms ?? 0,
      errorRate: overview?.error_rate_percent ?? 0,
      apdex: overview?.apdex ?? 0,
    }),
    [overview]
  )

  const refetchOverview = () => {
    if (!serviceName) return
    const sn = decodeURIComponent(serviceName)
    setOverviewError(null)
    api.get<OverviewResponse>(`/api/v1/metrics/services/${encodeURIComponent(sn)}/overview`).then((r) => setOverview(r.data)).catch(() => {})
  }

  const chartColor = { stroke: '#3b82f6', fill: '#3b82f6' }
  const tooltipStyle = {
    contentStyle: { backgroundColor: '#1f2937', border: '1px solid #374151' },
    labelStyle: { color: '#9ca3af' },
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-2">
          <Link to="/apm" className="hover:text-white transition-colors">
            APM
          </Link>
          <span>/</span>
          <span className="text-white font-medium">{displayName}</span>
        </nav>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">{displayName}</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 text-sm bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {TIME_RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-b border-gray-700/50 mb-6">
        <nav className="flex gap-4">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          {overviewLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
                  <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-700 rounded w-16"></div>
                </div>
              ))}
            </div>
          ) : overviewError ? (
            <div className="bg-gray-800 rounded-lg border border-red-900/50 p-6 flex items-center justify-between">
              <p className="text-red-400">{overviewError}</p>
              <button
                onClick={refetchOverview}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Throughput</p>
                      <p className="text-2xl font-bold text-white mt-1">{stats.throughput}</p>
                      <p className="text-xs text-gray-500">req/min</p>
                    </div>
                    <Activity className="w-8 h-8 text-blue-400" />
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Avg Response Time</p>
                      <p className="text-2xl font-bold text-white mt-1">{stats.avgResponseTime}ms</p>
                    </div>
                    <Clock className="w-8 h-8 text-yellow-400" />
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Error Rate</p>
                      <p className="text-2xl font-bold text-white mt-1">{stats.errorRate}%</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                </div>
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Apdex Score</p>
                      <div className="mt-2">
                        <ApdexGauge score={stats.apdex} size={80} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {transactionsLoading ? (
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 h-[280px] animate-pulse" />
              ) : chartData.length > 0 ? (
                <>
                  <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">Response Time (P50, P95, P99)</h2>
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                        <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} />
                        <Legend />
                        <Line type="monotone" dataKey="p50" stroke="#22c55e" name="P50" strokeWidth={2} />
                        <Line type="monotone" dataKey="p95" stroke="#eab308" name="P95" strokeWidth={2} />
                        <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                      <h2 className="text-lg font-semibold text-white mb-4">Throughput</h2>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} />
                          <Area type="monotone" dataKey="requests" stroke={chartColor.stroke} fill={chartColor.fill} fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
                      <h2 className="text-lg font-semibold text-white mb-4">Error Rate</h2>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                          <XAxis dataKey="time" stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                          <YAxis stroke="#9ca3af" tick={{ fill: '#9ca3af' }} />
                          <Tooltip contentStyle={tooltipStyle.contentStyle} labelStyle={tooltipStyle.labelStyle} />
                          <Area type="monotone" dataKey="rate" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 text-center text-gray-400">
                  No chart data available. Transaction data is needed to generate time-series.
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === 'transactions' && (
        <div className="space-y-6">
          <div className="bg-gray-800/50 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Transaction Traces</h2>
            {transactionsLoading ? (
              <div className="h-48 animate-pulse bg-gray-700/30 rounded-lg" />
            ) : transactionsError ? (
              <div className="text-red-400 py-4">{transactionsError}</div>
            ) : transactions.length === 0 ? (
              <div className="text-gray-400 py-8 text-center">No transactions found</div>
            ) : (
              <TransactionList transactions={transactions} />
            )}
          </div>
          {slowTransactions.length > 0 && (
            <div className="bg-gray-800/50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Slow Transactions</h2>
              <TransactionList transactions={groupTransactionsByEndpoint(slowTransactions)} />
            </div>
          )}
        </div>
      )}

      {activeTab === 'database' && (
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Slow Queries</h2>
          {databaseLoading ? (
            <div className="h-48 animate-pulse bg-gray-700/30 rounded-lg" />
          ) : databaseError ? (
            <div className="text-red-400 py-4">{databaseError}</div>
          ) : slowQueries.length === 0 ? (
            <div className="text-gray-400 py-8 text-center">No database query data available</div>
          ) : (
            <SlowQueries queries={slowQueries} />
          )}
        </div>
      )}

      {activeTab === 'external' && (
        <div className="bg-gray-800/50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-white mb-4">External Service Calls</h2>
          {externalLoading ? (
            <div className="h-48 animate-pulse bg-gray-700/30 rounded-lg" />
          ) : externalError ? (
            <div className="text-red-400 py-4">{externalError}</div>
          ) : externalServicesList.length === 0 ? (
            <div className="text-gray-400 py-8 text-center">No external service data available</div>
          ) : (
            <ExternalServices services={externalServicesList} />
          )}
        </div>
      )}

    </div>
  )
}
