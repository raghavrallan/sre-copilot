import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuthStore } from '../../lib/stores/auth-store'
import {
  ExternalLink,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Settings,
  Copy,
  Check,
  Database,
  BarChart3,
  Gauge,
  Clock,
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

interface PrometheusMetricsProps {
  serviceName: string
}

const SUGGESTED_QUERIES = [
  {
    label: 'Request Rate',
    icon: Activity,
    template: (service: string) => `rate(http_requests_total{service="${service}"}[5m])`,
    description: 'Requests per second over 5 minutes',
  },
  {
    label: 'Error Rate',
    icon: AlertTriangle,
    template: (service: string) => `rate(http_requests_total{service="${service}",status=~"5.."}[5m])`,
    description: '5xx errors per second',
  },
  {
    label: 'P99 Latency',
    icon: Gauge,
    template: (service: string) => `histogram_quantile(0.99, rate(http_request_duration_seconds_bucket{service="${service}"}[5m]))`,
    description: '99th percentile response time',
  },
  {
    label: 'P50 Latency',
    icon: Clock,
    template: (service: string) => `histogram_quantile(0.50, rate(http_request_duration_seconds_bucket{service="${service}"}[5m]))`,
    description: 'Median response time',
  },
  {
    label: 'Up Status',
    icon: CheckCircle2,
    template: (service: string) => `up{job="${service}"}`,
    description: 'Service availability',
  },
  {
    label: 'Memory Usage',
    icon: Database,
    template: (service: string) => `process_resident_memory_bytes{job="${service}"}`,
    description: 'Process memory consumption',
  },
]

export default function PrometheusMetrics({ serviceName }: PrometheusMetricsProps) {
  const { currentProject } = useAuthStore()
  const [integrations, setIntegrations] = useState<MonitoringIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedQuery, setCopiedQuery] = useState<string | null>(null)

  useEffect(() => {
    const fetchIntegrations = async () => {
      if (!currentProject) return
      try {
        const response = await api.get(
          `/api/v1/projects/${currentProject.id}/monitoring/integrations`
        )
        setIntegrations(response.data || [])
      } catch (err) {
        console.error('Failed to fetch monitoring integrations:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchIntegrations()
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
            {[1, 2].map((i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!prometheus && !grafana) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          <BarChart3 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Monitoring Integrations</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">
          Connect Prometheus or Grafana to see real-time metrics for this service directly in the incident view.
        </p>
        <a
          href="/settings"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Configure Monitoring
        </a>
      </div>
    )
  }

  return (
    <div className="space-y-6">
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
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : prometheus.last_test_success === false ? (
                <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                  <XCircle className="w-3 h-3" /> Error
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Unknown</span>
              )}
            </div>
            {prometheus.last_test_at && (
              <p className="text-xs text-gray-400 mb-3">
                Last tested: {new Date(prometheus.last_test_at).toLocaleString()}
              </p>
            )}
            {prometheus.last_error_message && (
              <div className="text-xs text-red-600 bg-red-50 rounded-lg p-2 mb-3">{prometheus.last_error_message}</div>
            )}
            <a
              href={buildPrometheusLink(`up{job="${serviceName}"}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-orange-600 hover:text-orange-700"
            >
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
                <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              ) : grafana.last_test_success === false ? (
                <span className="flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                  <XCircle className="w-3 h-3" /> Error
                </span>
              ) : (
                <span className="text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">Unknown</span>
              )}
            </div>
            {grafana.last_test_at && (
              <p className="text-xs text-gray-400 mb-3">
                Last tested: {new Date(grafana.last_test_at).toLocaleString()}
              </p>
            )}
            <a
              href={`${grafana.url}/explore`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-700 hover:text-yellow-800"
            >
              Open in Grafana <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Suggested PromQL Queries */}
      {prometheus && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Suggested Queries for <span className="text-blue-600">{serviceName}</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {SUGGESTED_QUERIES.map((q) => {
              const query = q.template(serviceName)
              const Icon = q.icon
              return (
                <div
                  key={q.label}
                  className="group border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-500 group-hover:text-blue-600" />
                      <span className="text-sm font-medium text-gray-900">{q.label}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => copyToClipboard(query, q.label)}
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title="Copy query"
                      >
                        {copiedQuery === q.label ? (
                          <Check className="w-3.5 h-3.5 text-green-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-gray-400" />
                        )}
                      </button>
                      <a
                        href={buildPrometheusLink(query)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded hover:bg-gray-200 transition-colors"
                        title="Open in Prometheus"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                      </a>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-2">{q.description}</p>
                  <code className="block text-xs text-gray-600 bg-gray-100 rounded px-2 py-1.5 font-mono break-all leading-relaxed">
                    {query}
                  </code>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
