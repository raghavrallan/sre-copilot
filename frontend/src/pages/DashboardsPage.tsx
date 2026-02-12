import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Plus, BarChart2, Server, FileText, AlertTriangle, Loader2, Trash2 } from 'lucide-react'
import api from '../services/api'

interface DashboardWidget {
  id: string
  title: string
  type: string
  metric_query: string
  width?: number
  height?: number
}

interface Dashboard {
  dashboard_id: string
  name: string
  description: string
  widgets: DashboardWidget[]
  variables: Record<string, unknown>
  created_at: string
  updated_at: string
}

const TEMPLATES = [
  { id: 'apm', name: 'APM Overview', icon: BarChart2, description: 'Application performance metrics' },
  { id: 'infra', name: 'Infrastructure', icon: Server, description: 'Host and container metrics' },
  { id: 'logs', name: 'Logs', icon: FileText, description: 'Log aggregation and search' },
  { id: 'incidents', name: 'Incidents', icon: AlertTriangle, description: 'Incident tracking and alerts' },
]

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  return `${diffDays} days ago`
}

export default function DashboardsPage() {
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchDashboards = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<Dashboard[]>('/api/v1/dashboards')
      setDashboards(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboards')
      setDashboards([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboards()
  }, [])

  const handleDelete = async (e: React.MouseEvent, dashboardId: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this dashboard?')) return
    setDeletingId(dashboardId)
    try {
      await api.delete(`/api/v1/dashboards/${dashboardId}`)
      setDashboards((prev) => prev.filter((d) => d.dashboard_id !== dashboardId))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dashboard')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <LayoutDashboard className="w-8 h-8 text-blue-400" />
            Dashboards
          </h1>
        </div>
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
        <button
          onClick={fetchDashboards}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-blue-400" />
          Dashboards
        </h1>
        <Link
          to="/dashboards/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Pre-built Templates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TEMPLATES.map((t) => {
            const Icon = t.icon
            return (
              <Link
                key={t.id}
                to={`/dashboards/new?template=${t.id}`}
                className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 hover:border-gray-600 transition-colors group"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-gray-700/50">
                    <Icon className="w-5 h-5 text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">{t.name}</h3>
                </div>
                <p className="text-sm text-gray-400">{t.description}</p>
              </Link>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Your Dashboards</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((d) => (
            <div
              key={d.dashboard_id}
              onClick={() => navigate(`/dashboards/${d.dashboard_id}`)}
              className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 hover:border-gray-600 transition-colors group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg bg-gray-700/50">
                  <LayoutDashboard className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">{formatRelativeTime(d.updated_at)}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(e, d.dashboard_id)
                    }}
                    disabled={deletingId === d.dashboard_id}
                    className="p-1 text-gray-400 hover:text-red-400 disabled:opacity-50"
                    title="Delete dashboard"
                  >
                    {deletingId === d.dashboard_id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">{d.name}</h3>
              <p className="text-sm text-gray-400 mb-4">{d.description || 'No description'}</p>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <LayoutDashboard className="w-4 h-4" />
                {(d.widgets?.length ?? 0)} widgets
              </div>
            </div>
          ))}
        </div>
        {dashboards.length === 0 && (
          <p className="text-gray-400 text-sm">No dashboards yet. Create one to get started.</p>
        )}
      </div>
    </div>
  )
}
