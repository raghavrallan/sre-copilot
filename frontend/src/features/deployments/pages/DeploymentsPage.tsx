import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle, Loader2, AlertCircle,
  XCircle, Clock, RotateCcw, Rocket, RefreshCw,
  Github, Server, Globe, Search, ChevronDown, ChevronUp, Settings,
} from 'lucide-react'
import api from '../../../services/api'

interface DeploymentApi {
  deployment_id: string
  service: string
  version: string
  commit_sha: string
  description: string
  deployed_by: string
  timestamp: string
  started_at?: string
  status?: string
  source?: string
  environment?: string
}

type DeploymentStatus = 'success' | 'failed' | 'in_progress' | 'rolled_back'

interface Deployment {
  id: string
  service: string
  version: string
  commitSha: string
  description: string
  deployedBy: string
  timestamp: string
  status: DeploymentStatus
  source: string
  environment: string
}

function mapApiToDeployment(raw: DeploymentApi): Deployment {
  return {
    id: raw.deployment_id,
    service: raw.service,
    version: raw.version,
    commitSha: raw.commit_sha,
    description: raw.description,
    deployedBy: raw.deployed_by,
    timestamp: raw.timestamp || raw.started_at || '',
    status: (raw.status as DeploymentStatus) || 'success',
    source: raw.source || 'manual',
    environment: raw.environment || 'production',
  }
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  if (diff < 0) return 'just now'
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return date.toLocaleDateString()
}

function formatDateGroup(dateStr: string): string {
  if (!dateStr) return 'Recent'
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Recent'
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
}

const STATUS_CONFIG: Record<DeploymentStatus, { label: string; textColor: string; bgColor: string; dotColor: string; icon: React.ReactNode }> = {
  success:     { label: 'Success',     textColor: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', dotColor: 'bg-emerald-500', icon: <CheckCircle className="w-4 h-4 text-emerald-600" /> },
  failed:      { label: 'Failed',      textColor: 'text-red-700',     bgColor: 'bg-red-50 border-red-200',         dotColor: 'bg-red-500',     icon: <XCircle className="w-4 h-4 text-red-600" /> },
  in_progress: { label: 'In Progress', textColor: 'text-amber-700',   bgColor: 'bg-amber-50 border-amber-200',     dotColor: 'bg-amber-500',   icon: <Loader2 className="w-4 h-4 text-amber-600 animate-spin" /> },
  rolled_back: { label: 'Rolled Back', textColor: 'text-orange-700',  bgColor: 'bg-orange-50 border-orange-200',   dotColor: 'bg-orange-500',  icon: <RotateCcw className="w-4 h-4 text-orange-600" /> },
}

function getSourceIcon(source: string) {
  switch (source) {
    case 'github': return <Github className="w-3.5 h-3.5" />
    case 'azure_devops': return <Server className="w-3.5 h-3.5" />
    case 'gitlab': return <Globe className="w-3.5 h-3.5" />
    default: return <Rocket className="w-3.5 h-3.5" />
  }
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeploymentStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchDeployments = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const { data } = await api.get<DeploymentApi[]>('/api/v1/deployments', {
        params: { limit: 100 },
      })
      setDeployments((data || []).map(mapApiToDeployment))
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : 'Failed to load deployments'
      setError(typeof msg === 'string' ? msg : 'Failed to load deployments')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { fetchDeployments() }, [])

  const services = useMemo(() => Array.from(new Set(deployments.map((d) => d.service))).sort(), [deployments])

  const filtered = useMemo(() => {
    let list = deployments
    if (serviceFilter) list = list.filter((d) => d.service === serviceFilter)
    if (statusFilter) list = list.filter((d) => d.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((d) =>
        d.service.toLowerCase().includes(q) ||
        d.description.toLowerCase().includes(q) ||
        d.commitSha.toLowerCase().includes(q) ||
        d.deployedBy.toLowerCase().includes(q)
      )
    }
    return list
  }, [deployments, serviceFilter, statusFilter, searchQuery])

  const stats = useMemo(() => {
    const total = deployments.length
    const success = deployments.filter(d => d.status === 'success').length
    const failed = deployments.filter(d => d.status === 'failed').length
    const inProgress = deployments.filter(d => d.status === 'in_progress').length
    const uniqueServices = new Set(deployments.map(d => d.service)).size
    const last24h = deployments.filter(d => {
      const ts = new Date(d.timestamp).getTime()
      return !isNaN(ts) && Date.now() - ts < 86400000
    }).length
    const successRate = total > 0 ? Math.round((success / total) * 100) : 0
    return { total, success, failed, inProgress, uniqueServices, last24h, successRate }
  }, [deployments])

  const groupedByDate = useMemo(() => {
    const groups: Record<string, Deployment[]> = {}
    for (const d of filtered) {
      const key = formatDateGroup(d.timestamp)
      if (!groups[key]) groups[key] = []
      groups[key].push(d)
    }
    return groups
  }, [filtered])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading deployments...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm">Failed to load deployments</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
          <button onClick={() => fetchDeployments()} className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (deployments.length === 0) {
    return (
      <div className="px-4 sm:px-0 max-w-xl mx-auto mt-16">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mx-auto mb-5">
            <Rocket className="w-7 h-7 text-blue-500" />
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">No deployments yet</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Connect your CI/CD provider and sync your repos to start tracking deployments automatically.
          </p>
          <Link
            to="/settings?tab=cicd"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            <Settings className="w-4 h-4" />
            Connect CI/CD Provider
          </Link>
          <div className="mt-8 grid grid-cols-3 gap-3 text-left">
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <Github className="w-5 h-5 text-gray-700 mb-1.5" />
              <p className="text-xs font-medium text-gray-700">GitHub</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Actions & Deploys</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <Server className="w-5 h-5 text-blue-500 mb-1.5" />
              <p className="text-xs font-medium text-gray-700">Azure DevOps</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Pipelines</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
              <Globe className="w-5 h-5 text-orange-500 mb-1.5" />
              <p className="text-xs font-medium text-gray-700">GitLab</p>
              <p className="text-[11px] text-gray-400 mt-0.5">CI/CD</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0 space-y-5 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <Rocket className="w-6 h-6 text-blue-500" />
            Deployments
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">{stats.total} deployments across {stats.uniqueServices} service{stats.uniqueServices !== 1 ? 's' : ''}</p>
        </div>
        <button
          onClick={() => fetchDeployments(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: <Rocket className="w-4 h-4 text-blue-500" />, bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Successful', value: stats.success, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50', border: 'border-emerald-100', valueColor: 'text-emerald-700' },
          { label: 'Failed', value: stats.failed, icon: <XCircle className="w-4 h-4 text-red-500" />, bg: 'bg-red-50', border: 'border-red-100', valueColor: 'text-red-700' },
          { label: 'Success Rate', value: `${stats.successRate}%`, icon: <CheckCircle className="w-4 h-4 text-emerald-500" />, bg: 'bg-emerald-50', border: 'border-emerald-100' },
          { label: 'Last 24h', value: stats.last24h, icon: <Clock className="w-4 h-4 text-purple-500" />, bg: 'bg-purple-50', border: 'border-purple-100' },
          { label: 'Services', value: stats.uniqueServices, icon: <Server className="w-4 h-4 text-cyan-500" />, bg: 'bg-cyan-50', border: 'border-cyan-100' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5">
            <div className={`w-8 h-8 rounded-lg ${s.bg} border ${s.border} flex items-center justify-center mb-2`}>
              {s.icon}
            </div>
            <p className={`text-xl font-bold ${s.valueColor || 'text-gray-900'}`}>{s.value}</p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-medium uppercase tracking-wide">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search deployments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 text-sm placeholder-gray-400 focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
          />
        </div>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-blue-500/30"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['', 'success', 'failed', 'in_progress'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s as DeploymentStatus | '')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                statusFilter === s
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>
        {(serviceFilter || statusFilter || searchQuery) && (
          <button
            onClick={() => { setServiceFilter(''); setStatusFilter(''); setSearchQuery('') }}
            className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto hidden sm:block">
          {filtered.length} of {deployments.length}
        </span>
      </div>

      {/* Deployment List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No deployments match your filters</p>
          <button
            onClick={() => { setServiceFilter(''); setStatusFilter(''); setSearchQuery('') }}
            className="mt-2 text-sm text-blue-600 hover:text-blue-700"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([date, deps]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-2.5">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{date}</h3>
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">{deps.length}</span>
              </div>
              <div className="space-y-2">
                {deps.map((d) => {
                  const sc = STATUS_CONFIG[d.status] || STATUS_CONFIG.success
                  const isExpanded = expandedId === d.id
                  return (
                    <div
                      key={d.id}
                      className={`bg-white rounded-xl border shadow-sm transition-all cursor-pointer hover:shadow-md ${
                        isExpanded ? 'border-blue-300 ring-1 ring-blue-100' : 'border-gray-200'
                      }`}
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    >
                      <div className="flex items-center gap-3 p-3.5">
                        {/* Status dot */}
                        <div className={`w-9 h-9 rounded-lg ${sc.bgColor} border flex items-center justify-center flex-shrink-0`}>
                          {sc.icon}
                        </div>

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{d.description || d.service}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                              {getSourceIcon(d.source)}
                              {d.service}
                            </span>
                            {d.commitSha && (
                              <>
                                <span className="text-gray-300">&middot;</span>
                                <code className="text-xs font-mono text-gray-400">{d.commitSha.slice(0, 7)}</code>
                              </>
                            )}
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-xs text-gray-400">{d.deployedBy}</span>
                          </div>
                        </div>

                        {/* Right side */}
                        <div className="flex items-center gap-2.5 flex-shrink-0">
                          <div className="text-right hidden sm:block">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.bgColor} ${sc.textColor} border`}>
                              {sc.label}
                            </span>
                            <p className="text-[11px] text-gray-400 mt-1">{timeAgo(d.timestamp)}</p>
                          </div>
                          <span className="px-2 py-0.5 text-[11px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded-md capitalize hidden md:block">
                            {d.environment}
                          </span>
                          {isExpanded
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                          }
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50/50 rounded-b-xl">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Service</p>
                              <p className="text-sm text-gray-900 font-medium">{d.service}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Version</p>
                              <p className="text-sm text-gray-900 font-mono">v{d.version}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Commit</p>
                              <p className="text-sm text-gray-900 font-mono">{d.commitSha || '—'}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Deployed by</p>
                              <p className="text-sm text-gray-900">{d.deployedBy}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Timestamp</p>
                              <p className="text-sm text-gray-900">{d.timestamp ? new Date(d.timestamp).toLocaleString() : '—'}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Source</p>
                              <p className="text-sm text-gray-900 capitalize inline-flex items-center gap-1.5">
                                {getSourceIcon(d.source)} {d.source}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Environment</p>
                              <p className="text-sm text-gray-900 capitalize">{d.environment}</p>
                            </div>
                            <div>
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Status</p>
                              <p className={`text-sm font-medium ${sc.textColor} inline-flex items-center gap-1.5`}>
                                {sc.icon} {sc.label}
                              </p>
                            </div>
                          </div>
                          {d.description && (
                            <div className="mt-3 pt-3 border-t border-gray-200/60">
                              <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide mb-1">Description</p>
                              <p className="text-sm text-gray-700">{d.description}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
