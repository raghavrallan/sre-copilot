import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import api from '../../services/api'
import { Incident } from '../../types/incident'
import { useWebSocketEvent } from '../../hooks/useWebSocketEvent'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function calcMTTR(incident: Incident): string | null {
  if (!incident.resolved_at) return null
  const start = new Date(incident.detected_at || incident.created_at).getTime()
  const end = new Date(incident.resolved_at).getTime()
  const diffMins = Math.floor((end - start) / 60000)
  if (diffMins < 60) return `${diffMins}m`
  const hours = Math.floor(diffMins / 60)
  if (hours < 24) return `${hours}h ${diffMins % 60}m`
  return `${Math.floor(hours / 24)}d ${hours % 24}h`
}

const severityDot: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
  info: 'bg-gray-400',
}

const stateBadge: Record<string, string> = {
  detected: 'bg-gray-100 text-gray-700',
  acknowledged: 'bg-blue-100 text-blue-700',
  investigating: 'bg-yellow-100 text-yellow-700',
  mitigated: 'bg-purple-100 text-purple-700',
  resolved: 'bg-green-100 text-green-700',
  learned: 'bg-green-100 text-green-700',
  closed: 'bg-gray-100 text-gray-600',
}

export default function RecentIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/v1/incidents?page=1&limit=10')
        setIncidents(data.items || data || [])
      } catch {
        setIncidents([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  useWebSocketEvent<Incident>('incident.created', (newIncident) => {
    setIncidents(prev => [newIncident, ...prev.slice(0, 9)])
  })

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Recent Incidents</h2>
        <Link to="/incidents" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-10 text-gray-400">
          <p className="text-sm">No incidents found</p>
          <p className="text-xs mt-1">Systems running smoothly</p>
        </div>
      ) : (
        <div className="overflow-x-auto -mx-6">
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="text-left py-2 pl-6 pr-3 font-medium">Incident</th>
                <th className="text-left py-2 px-3 font-medium">Service</th>
                <th className="text-left py-2 px-3 font-medium">Severity</th>
                <th className="text-left py-2 px-3 font-medium">State</th>
                <th className="text-left py-2 px-3 font-medium">MTTR</th>
                <th className="text-right py-2 pr-6 pl-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => {
                const mttr = calcMTTR(inc)
                return (
                  <tr key={inc.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-2.5 pl-6 pr-3 max-w-[200px]">
                      <Link
                        to={`/incidents/${inc.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors truncate block"
                        title={inc.title}
                      >
                        {inc.title}
                      </Link>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-sm text-gray-600">{inc.service_name || '-'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${severityDot[inc.severity] || 'bg-gray-400'}`} />
                        <span className="text-sm text-gray-700 capitalize">{inc.severity}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${stateBadge[inc.state] || 'bg-gray-100 text-gray-600'}`}>
                        {inc.state}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-sm text-gray-500 tabular-nums">{mttr || '-'}</span>
                    </td>
                    <td className="py-2.5 pr-6 pl-3 text-right">
                      <span className="text-sm text-gray-400">{timeAgo(inc.detected_at || inc.created_at)}</span>
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
