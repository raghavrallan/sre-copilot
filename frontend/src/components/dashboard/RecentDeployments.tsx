import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Rocket, ArrowRight, CheckCircle, XCircle, Clock } from 'lucide-react'
import api from '../../services/api'

interface Deployment {
  id: string
  service: string
  version: string
  status: string
  deployedAt: string
}

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

export default function RecentDeployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/v1/deployments')
        const list = Array.isArray(data?.deployments) ? data.deployments : (Array.isArray(data) ? data : [])
        setDeployments(list.slice(0, 5).map((d: any) => ({
          id: d.id || d.deployment_id || `dep-${Math.random()}`,
          service: d.service_name || d.service || 'unknown',
          version: d.version || d.tag || d.commit_sha?.slice(0, 7) || 'N/A',
          status: d.status || 'success',
          deployedAt: d.deployed_at || d.created_at || new Date().toISOString(),
        })))
      } catch {
        setDeployments([])
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const statusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Rocket className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Recent Deployments</h2>
        </div>
        <Link to="/deployments" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : deployments.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[160px] text-gray-400">
          <Rocket className="w-8 h-8 mb-2 text-gray-300" />
          <p className="text-sm">No recent deployments</p>
        </div>
      ) : (
        <div className="space-y-2">
          {deployments.map(dep => (
            <div key={dep.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
              {statusIcon(dep.status)}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{dep.service}</p>
                <p className="text-xs text-gray-400">{dep.version}</p>
              </div>
              <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(dep.deployedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
