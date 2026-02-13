import { useState, useEffect, Fragment } from 'react'
import { Shield, ChevronDown, ChevronRight, Loader2, AlertCircle } from 'lucide-react'
import api from '../services/api'

interface VulnerabilityApi {
  vuln_id: string
  cve_id: string
  title: string
  description: string
  severity: string
  service_name: string
  package_name: string
  installed_version: string
  fixed_version: string | null
  source: string
  status: string
  first_detected: string
  last_seen: string
}

interface OverviewApi {
  total: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  by_service: Record<string, number>
}

interface Vulnerability {
  id: string
  cveId: string
  title: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  service: string
  package: string
  installedVersion: string
  fixedVersion: string
  status: 'open' | 'patched' | 'ignored' | 'in_progress' | 'false_positive'
  source: string
  description: string
}

function mapStatus(apiStatus: string): Vulnerability['status'] {
  if (apiStatus === 'resolved') return 'patched'
  if (['open', 'in_progress', 'ignored', 'false_positive'].includes(apiStatus)) {
    return apiStatus as Vulnerability['status']
  }
  return 'open'
}

function mapApiToVuln(raw: VulnerabilityApi): Vulnerability {
  return {
    id: raw.vuln_id,
    cveId: raw.cve_id,
    title: raw.title,
    severity: raw.severity as Vulnerability['severity'],
    service: raw.service_name,
    package: raw.package_name,
    installedVersion: raw.installed_version,
    fixedVersion: raw.fixed_version ?? '-',
    status: mapStatus(raw.status),
    source: raw.source,
    description: raw.description,
  }
}

export default function SecurityPage() {
  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [overview, setOverview] = useState<OverviewApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedTree, setExpandedTree] = useState<Record<string, boolean>>({})
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const services = Array.from(new Set(vulns.map((v) => v.service))).sort()

  const filtered = vulns.filter((v) => {
    if (severityFilter && v.severity !== severityFilter) return false
    if (serviceFilter && v.service !== serviceFilter) return false
    if (statusFilter && v.status !== statusFilter) return false
    return true
  })

  useEffect(() => {
    let cancelled = false
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const [vulnsRes, overviewRes] = await Promise.all([
          api.get<VulnerabilityApi[]>('/api/v1/security/vulnerabilities', {
            params: {
              ...(severityFilter && { severity: severityFilter }),
              ...(serviceFilter && { service: serviceFilter }),
              ...(statusFilter && { status: statusFilter === 'patched' ? 'resolved' : statusFilter }),
            },
          }),
          api.get<OverviewApi>('/api/v1/security/vulnerabilities/overview'),
        ])
        if (!cancelled) {
          setVulns((vulnsRes.data || []).map(mapApiToVuln))
          setOverview(overviewRes.data ?? null)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Failed to load vulnerabilities'
          setError(typeof msg === 'string' ? msg : 'Failed to load vulnerabilities')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [severityFilter, serviceFilter, statusFilter])

  const handleStatusChange = async (vulnId: string, newStatus: string) => {
    const apiStatus = newStatus === 'patched' ? 'resolved' : newStatus
    setUpdatingStatus(vulnId)
    try {
      await api.patch(`/api/v1/security/vulnerabilities/${vulnId}`, { status: apiStatus })
      setVulns((prev) =>
        prev.map((v) =>
          v.id === vulnId ? { ...v, status: mapStatus(apiStatus) } : v
        )
      )
      if (overview) {
        setOverview((o) => {
          if (!o) return o
          const byStatus = { ...o.by_status }
          byStatus[apiStatus] = (byStatus[apiStatus] || 0) + 1
          const oldStatus = vulns.find((v) => v.id === vulnId)?.status
          const oldApiStatus = oldStatus === 'patched' ? 'resolved' : oldStatus
          if (oldApiStatus) {
            byStatus[oldApiStatus] = Math.max(0, (byStatus[oldApiStatus] || 1) - 1)
          }
          return { ...o, by_status: byStatus }
        })
      }
    } catch {
      // Could show toast
    } finally {
      setUpdatingStatus(null)
    }
  }

  const getSeverityColor = (s: Vulnerability['severity']) => {
    switch (s) {
      case 'critical': return 'bg-red-500/20 text-red-400'
      case 'high': return 'bg-orange-500/20 text-orange-400'
      case 'medium': return 'bg-yellow-500/20 text-yellow-400'
      case 'low': return 'bg-blue-500/20 text-blue-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusColor = (s: Vulnerability['status']) => {
    switch (s) {
      case 'open': return 'bg-red-500/20 text-red-400'
      case 'patched': return 'bg-green-500/20 text-green-400'
      case 'ignored': return 'bg-gray-500/20 text-gray-400'
      case 'in_progress': return 'bg-yellow-500/20 text-yellow-400'
      case 'false_positive': return 'bg-gray-500/20 text-gray-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const byService = vulns.reduce<Record<string, Vulnerability[]>>((acc, v) => {
    if (!acc[v.service]) acc[v.service] = []
    acc[v.service].push(v)
    return acc
  }, {})

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Shield className="w-8 h-8 text-blue-400" />
          Security & Vulnerabilities
        </h1>
        <p className="text-sm text-gray-400 mt-2">CVE tracking and dependency security</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <p className="text-sm text-gray-400">Critical</p>
          <p className="text-2xl font-bold text-red-400">{overview?.by_severity?.critical ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <p className="text-sm text-gray-400">High</p>
          <p className="text-2xl font-bold text-orange-400">{overview?.by_severity?.high ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <p className="text-sm text-gray-400">Medium</p>
          <p className="text-2xl font-bold text-yellow-400">{overview?.by_severity?.medium ?? 0}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <p className="text-sm text-gray-400">Low</p>
          <p className="text-2xl font-bold text-blue-400">{overview?.by_severity?.low ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="patched">Patched</option>
          <option value="ignored">Ignored</option>
          <option value="in_progress">In Progress</option>
          <option value="false_positive">False Positive</option>
        </select>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden mb-8">
        <table className="min-w-full">
          <thead>
            <tr className="border-b border-gray-700">
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">CVE ID</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Title</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Severity</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Service</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Package</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Installed</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Fixed</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Status</th>
              <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  No vulnerabilities found.
                </td>
              </tr>
            ) : (
              filtered.map((v) => (
                <Fragment key={v.id}>
                  <tr
                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-white font-mono text-sm">{v.cveId}</td>
                    <td className="px-4 py-3 text-white max-w-xs truncate">{v.title}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(v.severity)}`}>
                        {v.severity}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">{v.service}</td>
                    <td className="px-4 py-3 text-gray-300">{v.package}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{v.installedVersion}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono text-sm">{v.fixedVersion}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={v.status === 'patched' ? 'resolved' : v.status}
                        onChange={(e) => handleStatusChange(v.id, e.target.value)}
                        disabled={updatingStatus === v.id}
                        className={`px-2 py-1 rounded text-xs font-medium border-0 bg-transparent cursor-pointer ${getStatusColor(v.status)}`}
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Patched</option>
                        <option value="ignored">Ignored</option>
                        <option value="false_positive">False Positive</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{v.source}</td>
                  </tr>
                  {expandedId === v.id && (
                    <tr className="border-b border-gray-700/50 bg-gray-900/50">
                      <td colSpan={9} className="px-4 py-4">
                        <div className="space-y-3">
                          <p className="text-sm text-gray-300">
                            <span className="text-gray-400">Description:</span> {v.description}
                          </p>
                          <div>
                            <span className="text-gray-400 text-sm block mb-1">Remediation:</span>
                            <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                              <li>Upgrade {v.package} to version {v.fixedVersion !== '-' ? v.fixedVersion : 'latest'} or later</li>
                              <li>Run <code className="bg-gray-700 px-1 rounded">npm update {v.package}</code> or equivalent</li>
                              <li>Redeploy the affected service after verification</li>
                            </ul>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Vulnerabilities by Service</h3>
        <div className="space-y-4">
          {Object.keys(byService).length === 0 ? (
            <p className="text-gray-400">No vulnerabilities to group.</p>
          ) : (
            Object.entries(byService).map(([service, serviceVulns]) => (
              <div key={service} className="border border-gray-700 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedTree((t) => ({ ...t, [service]: !t[service] }))}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-gray-700/30 text-left text-white font-medium hover:bg-gray-700/50"
                >
                  {expandedTree[service] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  {service}
                </button>
                {expandedTree[service] && (
                  <div className="p-4 space-y-2">
                    {serviceVulns.map((v) => (
                      <div key={v.id} className="pl-4 border-l-2 border-gray-600">
                        <span className="text-white font-mono">{v.package}</span>
                        <span className="text-gray-400 ml-2">@{v.installedVersion}</span>
                        <span className={`ml-2 px-2 py-0.5 rounded text-xs ${getSeverityColor(v.severity)}`}>
                          {v.severity}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
