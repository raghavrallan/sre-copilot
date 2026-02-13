import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Bug, RefreshCw } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import api from '../services/api'

export interface ErrorGroupItem {
  fingerprint: string
  errorClass: string
  normalizedMessage: string
  occurrenceCount: number
  firstSeen: string
  lastSeen: string
  trendData: Array<{ time: string; count: number }>
  services: string[]
  status: 'unresolved' | 'investigating' | 'resolved' | 'ignored'
}

const STATUS_OPTIONS = ['unresolved', 'investigating', 'resolved', 'ignored'] as const

interface ErrorGroupApi {
  fingerprint: string
  service_name: string
  error_class: string
  message: string
  occurrence_count: number
  first_seen: string
  last_seen: string
  status: 'unresolved' | 'investigating' | 'resolved' | 'ignored'
  assignee: string | null
  notes: string | null
  occurrences?: Array<{ timestamp: string }>
}

const getStatusBadgeClasses = (status: ErrorGroupItem['status']) => {
  switch (status) {
    case 'unresolved':
      return 'bg-red-900/60 text-red-300 border-red-600/50'
    case 'investigating':
      return 'bg-yellow-900/60 text-yellow-300 border-yellow-600/50'
    case 'resolved':
      return 'bg-green-900/60 text-green-300 border-green-600/50'
    case 'ignored':
      return 'bg-gray-700 text-gray-400 border-gray-600'
    default:
      return 'bg-gray-700 text-gray-400'
  }
}

function occurrencesToTrendData(occurrences?: Array<{ timestamp: string }>): Array<{ time: string; count: number }> {
  if (!occurrences || occurrences.length === 0) return []
  const buckets = new Map<string, number>()
  for (const o of occurrences) {
    const d = new Date(o.timestamp)
    const key = `${d.getDate()}/${d.getMonth() + 1}`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries())
    .sort((a, b) => {
      const [da, ma] = a[0].split('/').map(Number)
      const [db, mb] = b[0].split('/').map(Number)
      return ma !== mb ? ma - mb : da - db
    })
    .map(([time, count]) => ({ time, count }))
}

export default function ErrorsPage() {
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState('Last 24h')
  const [groups, setGroups] = useState<ErrorGroupItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [services, setServices] = useState<string[]>([])

  const fetchErrorGroups = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (serviceFilter) params.service = serviceFilter
      if (statusFilter) params.status = statusFilter
      const response = await api.get<ErrorGroupApi[]>('/api/v1/errors/groups', { params })
      const data = response.data ?? []
      const mapped: ErrorGroupItem[] = data.map((g) => ({
        fingerprint: g.fingerprint,
        errorClass: g.error_class,
        normalizedMessage: g.message,
        occurrenceCount: g.occurrence_count,
        firstSeen: g.first_seen,
        lastSeen: g.last_seen,
        trendData: occurrencesToTrendData(g.occurrences),
        services: [g.service_name],
        status: g.status,
      }))
      setGroups(mapped)
      const svcSet = new Set<string>()
      mapped.forEach((g) => g.services.forEach((s) => svcSet.add(s)))
      setServices(Array.from(svcSet).sort())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error groups')
      setGroups([])
    } finally {
      setLoading(false)
    }
  }, [serviceFilter, statusFilter])

  useEffect(() => {
    fetchErrorGroups()
  }, [fetchErrorGroups])

  const filtered = useMemo(() => groups, [groups])

  const stats = useMemo(() => {
    const total = filtered.length
    const unresolved = filtered.filter((g) => g.status === 'unresolved').length
    const today = new Date().toDateString()
    const newToday = filtered.filter(
      (g) => new Date(g.lastSeen).toDateString() === today && g.status !== 'resolved'
    ).length
    const regression = filtered.filter(
      (g) => g.status === 'resolved' && new Date(g.lastSeen) > new Date(Date.now() - 86400000)
    ).length
    return { total, unresolved, newToday, regression }
  }, [filtered])

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Bug className="w-8 h-8 text-red-400" />
            Errors Inbox
          </h1>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-24 mb-2"></div>
              <div className="h-8 bg-gray-700 rounded w-12"></div>
            </div>
          ))}
        </div>
        <div className="h-48 animate-pulse bg-gray-800 rounded-lg" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white flex items-center gap-2">
            <Bug className="w-8 h-8 text-red-400" />
            Errors Inbox
          </h1>
        </div>
        <div className="bg-gray-800 rounded-lg border border-red-900/50 p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchErrorGroups}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Bug className="w-8 h-8 text-red-400" />
          Errors Inbox
        </h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Total Groups</span>
          <p className="text-2xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Unresolved</span>
          <p className="text-2xl font-bold text-red-400">{stats.unresolved}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">New Today</span>
          <p className="text-2xl font-bold text-yellow-400">{stats.newToday}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Regression</span>
          <p className="text-2xl font-bold text-orange-400">{stats.regression}</p>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
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

      {filtered.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-12 text-center">
          <Bug className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">No error groups</h3>
          <p className="text-gray-400">No errors match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <Link
              key={group.fingerprint}
              to={`/errors/${encodeURIComponent(group.fingerprint)}`}
              className="block rounded-lg border border-gray-700/50 bg-gray-800/50 p-4 hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{group.errorClass}</span>
                    <span
                      className={`px-2 py-0.5 text-xs font-semibold rounded border ${getStatusBadgeClasses(group.status)}`}
                    >
                      {group.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-2 truncate">{group.normalizedMessage}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                    <span>{group.occurrenceCount} occurrences</span>
                    <span>First: {new Date(group.firstSeen).toLocaleString()}</span>
                    <span>Last: {new Date(group.lastSeen).toLocaleString()}</span>
                    {group.services.map((s) => (
                      <span key={s} className="px-2 py-0.5 rounded bg-gray-700/60 text-gray-400">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="w-full lg:w-32 h-12 flex-shrink-0">
                  {group.trendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={group.trendData}>
                        <defs>
                          <linearGradient id={`grad-${group.fingerprint}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" hide />
                        <YAxis hide />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#ef4444"
                          fill={`url(#grad-${group.fingerprint})`}
                          strokeWidth={1}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-500 text-xs">
                      No trend
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
