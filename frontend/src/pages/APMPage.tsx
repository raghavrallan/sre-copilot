import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Clock, AlertTriangle, Server, Database, ArrowRight, RefreshCw } from 'lucide-react'
import api from '../services/api'

interface APMService {
  id: string
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
  sparkline: number[]
}

interface ServicesOverviewResponse {
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
  sparkline: number[]
}

export default function APMPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<APMService[]>([])
  const navigate = useNavigate()

  const fetchServices = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<ServicesOverviewResponse[]>('/api/v1/metrics/services-overview')
      const data = response.data
      if (Array.isArray(data)) {
        setServices(
          data.map((s) => ({
            id: s.name,
            name: s.name,
            throughput: s.throughput ?? 0,
            avgResponseTime: s.avgResponseTime ?? 0,
            errorRate: s.errorRate ?? 0,
            sparkline: Array.isArray(s.sparkline) ? s.sparkline : [],
          }))
        )
      } else {
        setServices([])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load services')
      setServices([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchServices()
  }, [])

  const getServiceIcon = (name: string) => {
    if (name.includes('api') || name.includes('gateway')) return Server
    if (name.includes('user') || name.includes('order') || name.includes('payment') || name.includes('inventory') || name.includes('notification')) return Activity
    if (name.includes('analytics')) return Database
    return Server
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            APM - Application Performance
          </h1>
          <p className="text-sm text-gray-400 mt-2">Monitor application performance across services</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-5 bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-20 mb-2"></div>
              <div className="h-4 bg-gray-700 rounded w-28 mb-4"></div>
              <div className="h-12 bg-gray-700 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            APM - Application Performance
          </h1>
          <p className="text-sm text-gray-400 mt-2">Monitor application performance across services</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-red-900/50 p-12 text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Failed to load services</h3>
          <p className="text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchServices}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (services.length === 0) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Activity className="w-8 h-8 text-blue-400" />
            APM - Application Performance
          </h1>
          <p className="text-sm text-gray-400 mt-2">Monitor application performance across services</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-12 text-center">
          <Server className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No services with APM data</h3>
          <p className="text-gray-400">
            Instrument your services with the SRE Copilot SDK to start collecting APM metrics.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Activity className="w-8 h-8 text-blue-400" />
          APM - Application Performance
        </h1>
        <p className="text-sm text-gray-400 mt-2">Monitor application performance across services</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => {
          const Icon = getServiceIcon(service.name)
          return (
            <div
              key={service.id}
              onClick={() => navigate(`/apm/${encodeURIComponent(service.name)}`)}
              className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 hover:border-gray-600/50 hover:shadow-lg transition-all cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-700/50">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <span className="font-semibold text-white">{service.name}</span>
                </div>
                <ArrowRight className="w-5 h-5 text-gray-500 group-hover:text-blue-400 transition-colors" />
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Activity className="w-4 h-4" /> Throughput
                  </span>
                  <span className="text-white font-medium">{service.throughput} req/min</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Avg Response
                  </span>
                  <span className="text-white font-medium">{service.avgResponseTime}ms</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Error Rate
                  </span>
                  <span
                    className={
                      service.errorRate > 1 ? 'text-red-400 font-medium' : 'text-white font-medium'
                    }
                  >
                    {service.errorRate}%
                  </span>
                </div>
              </div>

              {service.sparkline.length > 0 && (
                <div className="h-10 flex items-end gap-0.5">
                  {service.sparkline.map((val, i) => (
                    <div
                      key={i}
                      className="flex-1 bg-blue-500/40 rounded-t min-w-[2px]"
                      style={{ height: `${(val / Math.max(...service.sparkline)) * 100}%` }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
