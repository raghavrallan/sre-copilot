import { useState, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Network, ArrowUpDown, ArrowDownUp } from 'lucide-react'
import api from '../services/api'

interface TraceSummary {
  trace_id: string
  duration_ms: number
  service_count: number
  span_count: number
}

type SortKey = 'duration' | 'spanCount' | 'serviceCount'
type SortOrder = 'asc' | 'desc'

export default function TracingPage() {
  const [serviceFilter, setServiceFilter] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState('Last 1h')
  const [sortKey, setSortKey] = useState<SortKey>('duration')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [services, setServices] = useState<string[]>([])
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [servicesLoading, setServicesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setServicesLoading(true)
    api.get<string[]>('/api/v1/metrics/services')
      .then((res) => {
        if (!cancelled) setServices(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load services')
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    const params: Record<string, string | number | undefined> = {
      limit: 50,
    }
    if (serviceFilter) params.service = serviceFilter
    if (minDuration) params.min_duration = parseFloat(minDuration)
    if (maxDuration) params.max_duration = parseFloat(maxDuration)
    if (statusFilter) params.status = statusFilter

    api.get<TraceSummary[]>('/api/v1/traces', { params })
      .then((res) => {
        if (!cancelled) setTraces(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load traces')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [serviceFilter, minDuration, maxDuration, statusFilter])

  const sorted = useMemo(() => {
    return [...traces].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'duration') cmp = a.duration_ms - b.duration_ms
      else if (sortKey === 'spanCount') cmp = a.span_count - b.span_count
      else cmp = a.service_count - b.service_count
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [traces, sortKey, sortOrder])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  const SortHeader = ({ label, key: k }: { label: string; key: SortKey }) => (
    <th
      className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white"
      onClick={() => toggleSort(k)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortKey === k && (
          sortOrder === 'asc' ? <ArrowUpDown className="w-4 h-4" /> : <ArrowDownUp className="w-4 h-4" />
        )}
      </div>
    </th>
  )

  const maxDurationInList = Math.max(...sorted.map((t) => t.duration_ms), 1)

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Network className="w-8 h-8 text-blue-400" />
          Distributed Tracing
        </h1>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            disabled={servicesLoading}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Min duration (ms)"
            value={minDuration}
            onChange={(e) => setMinDuration(e.target.value)}
            className="px-3 py-2 w-36 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="number"
            placeholder="Max duration (ms)"
            value={maxDuration}
            onChange={(e) => setMaxDuration(e.target.value)}
            className="px-3 py-2 w-36 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            <option value="ok">OK</option>
            <option value="error">Error</option>
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            <option>Last 15m</option>
            <option>Last 1h</option>
            <option>Last 24h</option>
            <option>Last 7d</option>
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800 p-12 text-center text-gray-400">
          Loading traces...
        </div>
      ) : (
        <div className="rounded-lg border border-gray-700/50 bg-gray-800 overflow-hidden">
          <table className="min-w-full">
            <thead className="bg-gray-900/80">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Trace ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Root Operation
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Duration Bar
                </th>
                <SortHeader label="Duration" key="duration" />
                <SortHeader label="Spans" key="spanCount" />
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {sorted.map((trace) => (
                <tr
                  key={trace.trace_id}
                  className="hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      to={`/tracing/${trace.trace_id}`}
                      className="text-sm font-mono text-blue-400 hover:text-blue-300"
                    >
                      {trace.trace_id.length > 16 ? `${trace.trace_id.slice(0, 16)}...` : trace.trace_id}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {trace.service_count} services
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">-</td>
                  <td className="px-6 py-4">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${(trace.duration_ms / maxDurationInList) * 100}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{trace.duration_ms}ms</td>
                  <td className="px-6 py-4 text-sm text-gray-300">{trace.span_count}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-900/60 text-green-300">
                      ok
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {sorted.length === 0 && !loading && (
            <div className="px-6 py-12 text-center text-gray-500">
              No traces found
            </div>
          )}
        </div>
      )}
    </div>
  )
}
