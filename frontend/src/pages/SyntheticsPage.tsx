import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Globe, Plus, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import api from '../services/api'

interface MonitorApi {
  monitor_id: string
  name: string
  type: string
  url: string
  enabled: boolean
  latest_result?: {
    timestamp: string
    success: boolean
    response_time_ms?: number
    status_code?: number
  }
}

interface ResultApi {
  timestamp: string
  success: boolean
  response_time_ms?: number
  status_code?: number
}

interface Monitor {
  id: string
  name: string
  type: 'ping' | 'api'
  url: string
  status: 'passing' | 'failing'
  lastCheck: string
}

interface Result {
  timestamp: string
  status: 'pass' | 'fail'
  responseTime: number
  statusCode: number
}

function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(iso)
    const now = new Date()
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (sec < 60) return `${sec} sec ago`
    if (sec < 3600) return `${Math.floor(sec / 60)} min ago`
    if (sec < 86400) return `${Math.floor(sec / 3600)} hr ago`
    return `${Math.floor(sec / 86400)} days ago`
  } catch {
    return iso
  }
}

function mapMonitor(raw: MonitorApi): Monitor {
  const type = raw.type === 'api_test' ? 'api' : 'ping'
  const status: 'passing' | 'failing' = raw.latest_result?.success ? 'passing' : 'failing'
  const lastCheck = raw.latest_result?.timestamp
    ? formatTimeAgo(raw.latest_result.timestamp)
    : 'Never'
  return {
    id: raw.monitor_id,
    name: raw.name,
    type: type as 'ping' | 'api',
    url: raw.url,
    status,
    lastCheck,
  }
}

function mapResult(raw: ResultApi): Result {
  return {
    timestamp: new Date(raw.timestamp).toLocaleTimeString(),
    status: raw.success ? 'pass' : 'fail',
    responseTime: raw.response_time_ms ?? 0,
    statusCode: raw.status_code ?? 0,
  }
}

export default function SyntheticsPage() {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedResults, setExpandedResults] = useState<Result[]>([])
  const [expandedResultsLoading, setExpandedResultsLoading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    type: 'api_test' as 'ping' | 'api_test',
    url: '',
    frequency_seconds: 60,
    assertions: ['status_code == 200'],
    enabled: true,
  })

  useEffect(() => {
    let cancelled = false
    async function fetchMonitors() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<MonitorApi[]>('/api/v1/synthetics/monitors')
        if (!cancelled) {
          setMonitors((data || []).map(mapMonitor))
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Failed to load monitors'
          setError(typeof msg === 'string' ? msg : 'Failed to load monitors')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMonitors()
    return () => { cancelled = true }
  }, [])

  const fetchResults = async (monitorId: string) => {
    setExpandedResultsLoading(true)
    setExpandedResults([])
    try {
      const { data } = await api.get<{ items: ResultApi[] }>(`/api/v1/synthetics/monitors/${monitorId}/results`)
      setExpandedResults((data?.items || []).map(mapResult))
    } catch {
      setExpandedResults([])
    } finally {
      setExpandedResultsLoading(false)
    }
  }

  const handleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setExpandedResults([])
    } else {
      setExpandedId(id)
      fetchResults(id)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const payload = {
        name: createForm.name,
        type: createForm.type,
        url: createForm.url,
        frequency_seconds: createForm.frequency_seconds,
        assertions: createForm.assertions,
        enabled: createForm.enabled,
      }
      const { data } = await api.post<MonitorApi>('/api/v1/synthetics/monitors', payload)
      setMonitors((prev) => [mapMonitor(data), ...prev])
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        type: 'api_test',
        url: '',
        frequency_seconds: 60,
        assertions: ['status_code == 200'],
        enabled: true,
      })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : 'Failed to create monitor'
      setCreateError(typeof msg === 'string' ? msg : 'Failed to create monitor')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const chartData = expandedResults
    .slice(0, 20)
    .reverse()
    .map((r, i) => ({ time: `${i}`, rt: r.responseTime }))

  if (loading) {
    return (
      <div className="px-4 sm:px-0 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Globe className="w-8 h-8 text-blue-400" />
          Synthetic Monitoring
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
        >
          <Plus className="w-4 h-4" />
          Create Monitor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {monitors.length === 0 ? (
          <div className="col-span-full bg-gray-800 rounded-lg border border-gray-700/50 p-12 text-center text-gray-400">
            No monitors found. Create one to get started.
          </div>
        ) : (
          monitors.map((m) => (
            <div
              key={m.id}
              onClick={() => handleExpand(m.id)}
              className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 cursor-pointer hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gray-700/50">
                    <Globe className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{m.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      m.type === 'api' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {m.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                {m.status === 'passing' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
              </div>
              <p className="text-sm text-gray-400 truncate mb-3">{m.url}</p>
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-gray-400">
                  Last: <span className="text-white font-medium">{m.lastCheck}</span>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {expandedId && (
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Results Timeline</h3>
          {expandedResultsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
            </div>
          ) : expandedResults.length > 0 ? (
            <>
              <div className="h-64 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
                    <Line type="monotone" dataKey="rt" stroke="#3b82f6" strokeWidth={2} dot={false} name="Response Time (ms)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <h4 className="text-sm font-medium text-gray-400 mb-3">Recent Results</h4>
              <div className="bg-gray-700/50 rounded-lg overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-600">
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Timestamp</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Status</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Response Time</th>
                      <th className="px-4 py-2 text-left text-gray-400 font-medium">Status Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expandedResults.map((r, i) => (
                      <tr key={i} className="border-b border-gray-600/50 last:border-0">
                        <td className="px-4 py-2 text-white">{r.timestamp}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'pass' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-300">{r.responseTime}ms</td>
                        <td className="px-4 py-2 text-gray-300">{r.statusCode}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-gray-400">No results available for this monitor.</p>
          )}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create Monitor</h3>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="My Monitor"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Type</label>
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value as 'ping' | 'api_test' }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                >
                  <option value="ping">Ping</option>
                  <option value="api_test">API</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input
                  required
                  value={createForm.url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, url: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  placeholder="https://example.com/health"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Frequency (seconds)</label>
                <input
                  type="number"
                  min={30}
                  max={86400}
                  value={createForm.frequency_seconds}
                  onChange={(e) => setCreateForm((f) => ({ ...f, frequency_seconds: parseInt(e.target.value, 10) || 60 }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
