import { useState, useEffect, useCallback } from 'react'
import { FileText, Search, RefreshCw } from 'lucide-react'
import LogList, { LogEntry } from '../components/logs/LogList'
import LogPatterns, { LogPattern } from '../components/logs/LogPatterns'
import api from '../services/api'

const LEVELS = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL'] as const
const TIME_RANGES = ['Last 15m', 'Last 1h', 'Last 24h', 'Last 7d'] as const

interface LogItemApi {
  timestamp: string
  level: string
  service_name: string
  message: string
  attributes?: Record<string, string | number | boolean>
  trace_id?: string
  span_id?: string
}

interface LogsSearchResponse {
  items: LogItemApi[]
  total: number
  limit: number
  offset: number
}

interface LogsServicesResponse {
  services: string[]
}

interface LogPatternApi {
  pattern: string
  count: number
  level: string
  sample: string
  first_seen: string
  last_seen: string
}

interface LogsPatternsResponse {
  patterns: LogPatternApi[]
}

interface LogsStatsResponse {
  total: number
  by_level: Record<string, number>
  by_service: Record<string, number>
}

export default function LogsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [timeRange, setTimeRange] = useState<string>(TIME_RANGES[1])
  const [liveTail, setLiveTail] = useState(false)
  const [activeTab, setActiveTab] = useState<'search' | 'patterns'>('search')

  const [services, setServices] = useState<string[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [servicesError, setServicesError] = useState<string | null>(null)

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [logsError, setLogsError] = useState<string | null>(null)
  const [logsTotal, setLogsTotal] = useState(0)

  const [patterns, setPatterns] = useState<LogPattern[]>([])
  const [patternsLoading, setPatternsLoading] = useState(false)
  const [patternsError, setPatternsError] = useState<string | null>(null)

  const [stats, setStats] = useState<LogsStatsResponse | null>(null)

  const fetchServices = useCallback(async () => {
    setServicesLoading(true)
    setServicesError(null)
    try {
      const response = await api.get<LogsServicesResponse>('/api/v1/logs/services')
      setServices(response.data?.services ?? [])
    } catch (err) {
      setServicesError(err instanceof Error ? err.message : 'Failed to load services')
      setServices([])
    } finally {
      setServicesLoading(false)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true)
    setLogsError(null)
    try {
      const params: Record<string, string | number> = { limit: 200 }
      if (searchQuery) params.query = searchQuery
      if (serviceFilter) params.service = serviceFilter
      if (levelFilter) params.level = levelFilter
      const response = await api.get<LogsSearchResponse>('/api/v1/logs/search', { params })
      const items = response.data?.items ?? []
      setLogs(
        items.map((item, idx) => ({
          id: item.trace_id ?? `log-${idx}`,
          timestamp: item.timestamp,
          level: (item.level?.toUpperCase() ?? 'INFO') as LogEntry['level'],
          service: item.service_name ?? 'unknown',
          message: item.message ?? '',
          attributes: item.attributes,
          trace_id: item.trace_id,
        }))
      )
      setLogsTotal(response.data?.total ?? 0)
    } catch (err) {
      setLogsError(err instanceof Error ? err.message : 'Failed to load logs')
      setLogs([])
    } finally {
      setLogsLoading(false)
    }
  }, [searchQuery, serviceFilter, levelFilter])

  const fetchPatterns = useCallback(async () => {
    setPatternsLoading(true)
    setPatternsError(null)
    try {
      const response = await api.get<LogsPatternsResponse>('/api/v1/logs/patterns')
      const pats = response.data?.patterns ?? []
      setPatterns(
        pats.map((p, idx) => ({
          id: `pattern-${idx}`,
          pattern: p.pattern ?? '',
          count: p.count ?? 0,
          level: (p.level?.toUpperCase() ?? 'INFO') as LogPattern['level'],
          sampleMessage: p.sample ?? '',
          firstSeen: p.first_seen ?? '',
          lastSeen: p.last_seen ?? '',
          frequencyData: [],
        }))
      )
    } catch (err) {
      setPatternsError(err instanceof Error ? err.message : 'Failed to load patterns')
      setPatterns([])
    } finally {
      setPatternsLoading(false)
    }
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get<LogsStatsResponse>('/api/v1/logs/stats')
      setStats(response.data)
    } catch {
      setStats(null)
    }
  }, [])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  useEffect(() => {
    if (activeTab === 'search') {
      fetchLogs()
    }
  }, [activeTab, fetchLogs])

  useEffect(() => {
    if (activeTab === 'patterns') {
      fetchPatterns()
    }
  }, [activeTab, fetchPatterns])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  const levelCounts = stats?.by_level ?? {}

  const handleSearch = () => {
    fetchLogs()
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <FileText className="w-8 h-8 text-blue-400" />
          Log Management
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLiveTail(!liveTail)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              liveTail
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${liveTail ? 'bg-white animate-pulse' : 'bg-gray-500'}`} />
            Live Tail
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 mb-4">
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={logsLoading}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${logsLoading ? 'animate-spin' : ''}`} />
            Search
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
            disabled={servicesLoading}
          >
            <option value="">All services</option>
            {services.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All levels</option>
            {LEVELS.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-sm text-white focus:ring-2 focus:ring-blue-500"
          >
            {TIME_RANGES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
        <div className="border-b border-gray-700/50">
          <div className="flex">
            <button
              onClick={() => setActiveTab('search')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'search'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`px-6 py-3 text-sm font-medium ${
                activeTab === 'patterns'
                  ? 'border-b-2 border-blue-500 text-blue-400'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Patterns
            </button>
          </div>
        </div>
        <div className="p-4">
          {activeTab === 'search' ? (
            <>
              {servicesError && (
                <div className="text-yellow-400 text-sm mb-2">Services: {servicesError}</div>
              )}
              {logsLoading ? (
                <div className="h-64 animate-pulse bg-gray-700/30 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">Loading logs...</span>
                </div>
              ) : logsError ? (
                <div className="py-8 text-center">
                  <p className="text-red-400 mb-4">{logsError}</p>
                  <button
                    onClick={fetchLogs}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <>
                  <div className="max-h-[500px] overflow-y-auto">
                    <LogList logs={logs} />
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-700/50 flex flex-wrap gap-4 text-sm text-gray-400">
                    <span>Total: {logsTotal}</span>
                    {LEVELS.map((l) =>
                      levelCounts[l] != null ? (
                        <span key={l}>
                          {l}: {levelCounts[l]}
                        </span>
                      ) : null
                    )}
                  </div>
                </>
              )}
            </>
          ) : (
            <>
              {patternsLoading ? (
                <div className="h-64 animate-pulse bg-gray-700/30 rounded-lg flex items-center justify-center">
                  <span className="text-gray-400">Loading patterns...</span>
                </div>
              ) : patternsError ? (
                <div className="py-8 text-center">
                  <p className="text-red-400 mb-4">{patternsError}</p>
                  <button
                    onClick={fetchPatterns}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Retry
                  </button>
                </div>
              ) : patterns.length === 0 ? (
                <div className="py-8 text-center text-gray-400">No log patterns found</div>
              ) : (
                <LogPatterns patterns={patterns} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
