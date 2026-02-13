import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Target, ArrowRight } from 'lucide-react'
import api from '../../services/api'

interface SLO {
  id: string
  name: string
  target: number
  current: number
  service?: string
}

export default function SLOStatusCard() {
  const [slos, setSlos] = useState<SLO[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/v1/slos')
        const list = Array.isArray(data?.slos) ? data.slos : (Array.isArray(data) ? data : [])
        setSlos(list.slice(0, 5).map((s: any) => ({
          id: s.id || s.slo_id || `slo-${Math.random()}`,
          name: s.name || 'Unnamed SLO',
          target: s.target_percentage ?? s.target ?? 99.9,
          current: s.current_value ?? s.current_percentage ?? s.compliance ?? 100,
          service: s.service_name || s.service || undefined,
        })))
      } catch {
        setSlos([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const getComplianceColor = (current: number, target: number) => {
    if (current >= target) return { bar: 'bg-green-500', text: 'text-green-700' }
    if (current >= target - 1) return { bar: 'bg-yellow-500', text: 'text-yellow-700' }
    return { bar: 'bg-red-500', text: 'text-red-700' }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">SLO Status</h2>
        </div>
        <Link to="/slos" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : slos.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[160px] text-gray-400">
          <Target className="w-8 h-8 mb-2 text-gray-300" />
          <p className="text-sm">No SLOs configured</p>
          <Link to="/slos" className="text-xs text-blue-500 hover:text-blue-600 mt-1">Create one</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {slos.map(slo => {
            const colors = getComplianceColor(slo.current, slo.target)
            const pct = Math.min((slo.current / 100) * 100, 100)
            const isMet = slo.current >= slo.target

            return (
              <div key={slo.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-700 truncate">{slo.name}</p>
                    {slo.service && <p className="text-xs text-gray-400">{slo.service}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
                      {slo.current.toFixed(1)}%
                    </span>
                    <span className={`w-1.5 h-1.5 rounded-full ${isMet ? 'bg-green-500' : 'bg-red-500'}`} />
                  </div>
                </div>
                <div className="relative h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                  <div
                    className="absolute top-0 bottom-0 w-px bg-gray-400"
                    style={{ left: `${slo.target}%` }}
                    title={`Target: ${slo.target}%`}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
