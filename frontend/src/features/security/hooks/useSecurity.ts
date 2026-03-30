import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuthStore } from '../../../stores/auth-store'
import * as securityApi from '../api'
import type {
  SecurityOverviewApi,
  Vulnerability,
  VulnerabilityApi,
  VulnerabilityStatus,
} from '../types'

function mapStatus(apiStatus: string): VulnerabilityStatus {
  if (apiStatus === 'resolved') return 'patched'
  if (['open', 'in_progress', 'ignored', 'false_positive'].includes(apiStatus)) {
    return apiStatus as VulnerabilityStatus
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

export function useSecurity() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [vulns, setVulns] = useState<Vulnerability[]>([])
  const [overview, setOverview] = useState<SecurityOverviewApi | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState('')
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expandedTree, setExpandedTree] = useState<Record<string, boolean>>({})
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null)

  const services = useMemo(
    () => Array.from(new Set(vulns.map((v) => v.service))).sort(),
    [vulns]
  )

  const filtered = useMemo(
    () =>
      vulns.filter((v) => {
        if (severityFilter && v.severity !== severityFilter) return false
        if (serviceFilter && v.service !== serviceFilter) return false
        if (statusFilter && v.status !== statusFilter) return false
        return true
      }),
    [vulns, severityFilter, serviceFilter, statusFilter]
  )

  useEffect(() => {
    if (!projectId) return
    const id = projectId
    let cancelled = false
    async function fetch() {
      setLoading(true)
      setError(null)
      try {
        const [vulnsRes, overviewRes] = await Promise.all([
          securityApi.fetchVulnerabilities(id, {
            ...(severityFilter && { severity: severityFilter }),
            ...(serviceFilter && { service: serviceFilter }),
            ...(statusFilter && {
              status: statusFilter === 'patched' ? 'resolved' : statusFilter,
            }),
          }),
          securityApi.fetchVulnerabilitiesOverview(id),
        ])
        if (!cancelled) {
          setVulns(vulnsRes.map(mapApiToVuln))
          setOverview(overviewRes)
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
              : 'Failed to load vulnerabilities'
          setError(typeof msg === 'string' ? msg : 'Failed to load vulnerabilities')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => {
      cancelled = true
    }
  }, [projectId, severityFilter, serviceFilter, statusFilter])

  const handleStatusChange = useCallback(
    async (vulnId: string, newStatus: string) => {
      if (!projectId) return
      const apiStatus = newStatus === 'patched' ? 'resolved' : newStatus
      setUpdatingStatus(vulnId)
      try {
        await securityApi.patchVulnerabilityStatus(projectId, vulnId, apiStatus)
        setVulns((prev) =>
          prev.map((v) => (v.id === vulnId ? { ...v, status: mapStatus(apiStatus) } : v))
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
    },
    [projectId, overview, vulns]
  )

  const byService = useMemo(
    () =>
      vulns.reduce<Record<string, Vulnerability[]>>((acc, v) => {
        if (!acc[v.service]) acc[v.service] = []
        acc[v.service].push(v)
        return acc
      }, {}),
    [vulns]
  )

  return {
    projectId,
    vulns,
    overview,
    loading,
    error,
    expandedId,
    setExpandedId,
    severityFilter,
    setSeverityFilter,
    serviceFilter,
    setServiceFilter,
    statusFilter,
    setStatusFilter,
    expandedTree,
    setExpandedTree,
    updatingStatus,
    services,
    filtered,
    handleStatusChange,
    byService,
  }
}
