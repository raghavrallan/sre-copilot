import { useEffect, useState, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import api from '../../../services/api'
import { useAuthStore } from '../../../stores/auth-store'
import {
  ExternalLink, Activity, CheckCircle2, XCircle, AlertTriangle,
  Settings, Copy, Check, Database, BarChart3, Gauge, Clock, Loader2, TrendingUp,
} from 'lucide-react'

interface MonitoringIntegration {
  id: string
  integration_type: string
  name: string
  url: string
  status: string
  is_primary: boolean
  last_test_at: string | null
  last_test_success: boolean | null
  last_error_message: string | null
  created_at: string
}

interface SeriesData {
  name: string
  ref_id: string
  data: { t: number; v: number }[]
}

interface PrometheusMetricsProps {
  serviceName: string
}

const SUGGESTED_QUERIES = [
  { label: 'Request Rate', icon: Activity, template: (s: string) => `rate(http_requests_total{service="${s}"}[5m])`, description: 'Requests per second', color: '#3B82F6' },
  { label: 'Error Rate', icon: AlertTriangle, template: (s: string) => `rate(http_requests_total{service="${s}",status=~"5.."}[5m])`, description: '5xx errors per second', color: '#EF4444' },
  { label: 'P99 Latency', icon: Gauge, template: (s: string) => `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="${s}"}[5m]))`, description: '99th percentile response time', color: '#F59E0B' },
  { label: 'P50 Latency', icon: Clock, template: (s: string) => `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{service="${s}"}[5m]))`, description: 'Median response time', color: '#8B5CF6' },
  { label: 'Up Status', icon: CheckCircle2, template: (s: string) => `up{job="${s}"}`, description: 'Service availability', color: '#10B981' },
  { label: 'Memory Usage', icon: Database, template: (s: string) => `process_resident_memory_bytes{job="${s}"}`, description: 'Process memory', color: '#EC4899' },
]

const COLORS = ['#3B82F6', '#EF4444', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899']

function formatTs(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatValue(v: number): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'G'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  return v.toFixed(2)
}

function InlineChart({ query, color }: { query: string; color: string }) {
  const [series, setSeries] = useState<SeriesData[] | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'empty' | 'error'>('loading')

  useEffect(() => {
    api.post('/api/v1/grafana/query', { expr: query, from_time: 'now-1h', to_time: 'now', step: 60 })
      .then(resp => {
        const s = resp.data.series || []
        setSeries(s)
        setStatus(s.length ? 'ok' : 'empty')
      })
      .catch(() => setStatus('error'))
  }, [query])

  const chartData = useMemo(() => {
    if (!series?.length) return []
    const allTs = new Set<number>()
    series.forEach(s => s.data.forEach(d => allTs.add(d.t)))
    return [...allTs].sort((a, b) => a - b).map(t => {
      const row: any = { t }
      series.forEach((s, i) => {
        const pt = s.data.find(d => d.t === t)
        row[`s${i}`] = pt?.v ?? null
      })
      return row
    })
  }, [series])

  if (status === 'loading') {
    return <div className="h-24 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
  }
  if (status === 'error' || status === 'empty') {
    return <div className="h-24 flex items-center justify-center text-xs text-gray-400">{status === 'error' ? 'Query failed' : 'No data'}</div>
  }

  return (
    <ResponsiveContainer width="100%" height={96}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" tickFormatter={formatTs} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
        <YAxis hide domain={['auto', 'auto']} />
        <Tooltip
          labelFormatter={(v) => formatTs(v as number)}
          formatter={(v: number) => [formatValue(v), '']}
          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        {(series || []).map((_, i) => (
          <Area key={i} type="monotone" dataKey={`s${i}`} stroke={color} fill={`url(#grad-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export default function PrometheusMetrics({ serviceName }: PrometheusMetricsProps) {
  const { currentProject } = useAuthStore()
  const [integrations, setIntegrations] = useState<MonitoringIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null)
  const [hasGrafana, setHasGrafana] = useState(false)

  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!currentProject) return
      try {
        const response = await api.get(`/api/v1/projects/${currentProject.id}/monitoring/integrations`)
        setIntegrations(response.data || [])
      } catch { /* ignore */ }
      setLoading(false)
    }
    fetchIntegrations()
    api.get('/api/v1/grafana/dashboards').then(() => setHasGrafana(true)).catch(() => {})
  }, [currentProject])

  const prometheus = integrations.find((i) => i.integration_type === 'prometheus')
  const grafana = integrations.find((i) => i.integration_type === 'grafana')

  const copyToClipboard = (query: string, label: string) => {
    navigator.clipboard.writeText(query)
    setCopiedQuery(label)
    setTimeout(() => setCopiedQuery(null), 2000)
  }

  const buildPrometheusLink = (query: string) => {
    if (!prometheus) return '#'
    return `${prometheus.url}/graph?g0.expr=${encodeURIComponent(query)}&g0.tab=0`
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-gray-100 rounded-xl" />)}
          </div>
        </div>
      </div>
    )
  }

  if (!prometheus && !grafana && !hasGrafana) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Monitoring Integrations</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          Connect Prometheus or Grafana to see real-time metrics for this service.
        </p>
        <a href="/settings" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Settings className="w-4 h-4" /> Configure Monitoring
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live Metric Charts from Grafana */}
      {hasGrafana && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-700">
              Live Metrics for <span className="text-blue-600">{serviceName}</span>
            </h3>
            <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full font-medium">via Grafana</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_QUERIES.map((q, idx) => {
              const query = q.template(serviceName)
              const Icon = q.icon
              return (
                <div key={q.label} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className="w-3.5 h-3.5" style={{ color: q.color }} />
                    <span className="text-xs font-semibold text-gray-800">{q.label}</span>
                    <span className="text-[10px] text-gray-400 ml-auto">{q.description}</span>
                  </div>
                  <InlineChart query={query} color={q.color} />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Integration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prometheus && (
          <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{prometheus.name || 'Prometheus'}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{prometheus.url}</p>
                </div>
              </div>
              {prometheus.last_test_success === true ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Connected</span>
              ) : prometheus.last_test_success === false ? (
                <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3" /> Error</span>
              ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Unknown</span>
              )}
            </div>
            <a href={buildPrometheusLink(`up{job="${serviceName}"}`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700">
              Open in Prometheus <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
        {grafana && (
          <div className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-yellow-700" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{grafana.name || 'Grafana'}</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[200px]">{grafana.url}</p>
                </div>
              </div>
              {grafana.last_test_success === true ? (
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3" /> Connected</span>
              ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Unknown</span>
              )}
            </div>
            <a href="/dashboards/grafana" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700">
              View Dashboards <BarChart3 className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Copyable Query Cards */}
      {prometheus && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            PromQL Queries for <span className="text-blue-600">{serviceName}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_QUERIES.map((q) => {
              const query = q.template(serviceName)
              const Icon = q.icon
              return (
                <div key={q.label} className="group border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-all">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">{q.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyToClipboard(query, q.label)} className="p-1 rounded hover:bg-gray-200" title="Copy query">
                        {copiedQuery === q.label ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-400" />}
                      </button>
                      <a href={buildPrometheusLink(query)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-gray-200" title="Open in Prometheus">
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{q.description}</p>
                  <code className="block text-xs text-gray-600 bg-gray-100 rounded px-2 py-1.5 font-mono break-all">{query}</code>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
