import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LineChart, Line, ResponsiveContainer } from 'recharts'
import { ArrowRight, Server } from 'lucide-react'
import api from '../../services/api'

interface ServiceInfo {
  name: string
  throughput: number
  avgResponseTime: number
  errorRate: number
  sparkline?: number[]
}

export default function ServicesOverview() {
  const [services, setServices] = useState<ServiceInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/v1/metrics/services-overview')
        const list = Array.isArray(data?.services) ? data.services : (Array.isArray(data) ? data : [])
        setServices(list.map((s: any) => ({
          name: s.name || s.service_name || 'unknown',
          throughput: s.throughput ?? 0,
          avgResponseTime: s.avgResponseTime ?? s.avg_response_time ?? 0,
          errorRate: s.errorRate ?? s.error_rate ?? 0,
          sparkline: Array.isArray(s.sparkline) ? s.sparkline : undefined,
        })))
      } catch {
        setServices([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
    const interval = setInterval(fetch, 30000)
    return () => clearInterval(interval)
  }, [])

  const getHealthBadge = (errorRate: number) => {
    if (errorRate >= 5) return { text: 'Critical', cls: 'bg-red-100 text-red-700' }
    if (errorRate >= 1) return { text: 'Degraded', cls: 'bg-yellow-100 text-yellow-700' }
    return { text: 'Healthy', cls: 'bg-green-100 text-green-700' }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Services Health</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Server className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Services Health</h2>
          <span className="text-xs text-gray-400 ml-1">({services.length} services)</span>
        </div>
        <Link to="/apm" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {services.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          No services reporting metrics yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left py-2 pr-4 font-medium">Service</th>
                <th className="text-left py-2 pr-4 font-medium">Status</th>
                <th className="text-right py-2 pr-4 font-medium">Throughput</th>
                <th className="text-right py-2 pr-4 font-medium">Avg Response</th>
                <th className="text-right py-2 pr-4 font-medium">Error Rate</th>
                <th className="text-right py-2 font-medium w-24">Trend</th>
              </tr>
            </thead>
            <tbody>
              {services.slice(0, 8).map((svc) => {
                const badge = getHealthBadge(svc.errorRate)
                const sparkData = (svc.sparkline || [0, 0, 0, 0, 0, 0, 0]).map((v, i) => ({ i, v }))
                const sparkColor = svc.errorRate >= 5 ? '#ef4444' : svc.errorRate >= 1 ? '#eab308' : '#22c55e'

                return (
                  <tr key={svc.name} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-2.5 pr-4">
                      <Link to={`/apm/${encodeURIComponent(svc.name)}`} className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors">
                        {svc.name}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                        {badge.text}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm text-gray-700 tabular-nums">
                      {svc.throughput.toLocaleString()} rpm
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm text-gray-700 tabular-nums">
                      {svc.avgResponseTime < 1000
                        ? `${Math.round(svc.avgResponseTime)} ms`
                        : `${(svc.avgResponseTime / 1000).toFixed(2)} s`}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-sm tabular-nums">
                      <span className={svc.errorRate >= 5 ? 'text-red-600 font-medium' : svc.errorRate >= 1 ? 'text-yellow-600' : 'text-gray-700'}>
                        {svc.errorRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2.5 w-24">
                      <ResponsiveContainer width="100%" height={24}>
                        <LineChart data={sparkData}>
                          <Line type="monotone" dataKey="v" stroke={sparkColor} strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
