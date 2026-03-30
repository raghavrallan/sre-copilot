import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BarChart3,
  ExternalLink,
  Folder,
  Loader2,
  RefreshCw,
  Search,
  Star,
  Tag,
  AlertTriangle,
  Settings,
} from 'lucide-react'
import api from '../../../services/api'

interface GrafanaDashboard {
  uid: string
  title: string
  url: string
  tags: string[]
  type: string
  folderTitle: string
  folderUid: string
  isStarred: boolean
}

interface GrafanaResponse {
  grafana_url: string
  grafana_name: string
  dashboards: GrafanaDashboard[]
}

export default function GrafanaDashboardsPage() {
  const [data, setData] = useState<GrafanaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null)

  const fetchDashboards = async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await api.get<GrafanaResponse>('/api/v1/grafana/dashboards')
      setData(resp.data)
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to load Grafana dashboards'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboards()
  }, [])

  const dashboards = (data?.dashboards || []).filter((d) => d.uid)
  const folders = [...new Set(dashboards.map((d) => d.folderTitle))].sort()

  const filtered = dashboards.filter((d) => {
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))
    const matchesFolder = !selectedFolder || d.folderTitle === selectedFolder
    return matchesSearch && matchesFolder
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-3 text-gray-600">Connecting to Grafana...</span>
      </div>
    )
  }

  if (error) {
    const isNotConfigured = error.includes('No Grafana integration')
    return (
      <div className="text-center py-24">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
          {isNotConfigured ? (
            <Settings className="w-8 h-8 text-gray-400" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-amber-500" />
          )}
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {isNotConfigured ? 'No Grafana Integration' : 'Connection Error'}
        </h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto mb-6">{error}</p>
        {isNotConfigured ? (
          <Link
            to="/settings?tab=monitoring"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <Settings className="w-4 h-4" />
            Configure Grafana
          </Link>
        ) : (
          <button
            onClick={fetchDashboards}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grafana Dashboards</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data?.grafana_name} &mdash; {dashboards.length} dashboard{dashboards.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchDashboards}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {data?.grafana_url && (
            <a
              href={data.grafana_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              <ExternalLink className="w-4 h-4" />
              Open Grafana
            </a>
          )}
        </div>
      </div>

      {/* Search + Folder filter */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search dashboards..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        {folders.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setSelectedFolder(null)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                !selectedFolder
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              All
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => setSelectedFolder(selectedFolder === f ? null : f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  selectedFolder === f
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Dashboard Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No dashboards found</p>
          <p className="text-sm mt-1">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
            <Link
              key={d.uid}
              to={`/dashboards/grafana/${d.uid}`}
              className="group block border border-gray-200 rounded-xl p-5 hover:shadow-lg hover:border-blue-300 transition-all bg-white"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors">
                    <BarChart3 className="w-5 h-5 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {d.title}
                    </h3>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Folder className="w-3 h-3" />
                      {d.folderTitle}
                    </div>
                  </div>
                </div>
                {d.isStarred && <Star className="w-4 h-4 text-amber-400 fill-amber-400 flex-shrink-0" />}
              </div>

              {d.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-3">
                  <Tag className="w-3 h-3 text-gray-400" />
                  {d.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">Click to view panels</span>
                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
