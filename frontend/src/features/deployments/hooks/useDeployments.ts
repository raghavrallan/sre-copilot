import { useState, useEffect, useMemo, useCallback } from 'react'
import * as deploymentsApi from '../api'
import type { Deployment, DeploymentStatus } from '../types'
import { formatDateGroup, mapApiToDeployment } from '../types'

function parseLoadError(err: unknown): string {
  const msg =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : 'Failed to load deployments'
  return typeof msg === 'string' ? msg : 'Failed to load deployments'
}

export function useDeployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [serviceFilter, setServiceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeploymentStatus | ''>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchDeployments = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const raw = await deploymentsApi.fetchDeployments({ limit: 100 })
      setDeployments(raw.map(mapApiToDeployment))
    } catch (err: unknown) {
      setError(parseLoadError(err))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchDeployments()
  }, [fetchDeployments])

  const services = useMemo(
    () => Array.from(new Set(deployments.map((d) => d.service))).sort(),
    [deployments]
  )

  const filtered = useMemo(() => {
    let list = deployments
    if (serviceFilter) list = list.filter((d) => d.service === serviceFilter)
    if (statusFilter) list = list.filter((d) => d.status === statusFilter)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (d) =>
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
    const success = deployments.filter((d) => d.status === 'success').length
    const failed = deployments.filter((d) => d.status === 'failed').length
    const inProgress = deployments.filter((d) => d.status === 'in_progress').length
    const uniqueServices = new Set(deployments.map((d) => d.service)).size
    const last24h = deployments.filter((d) => {
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

  const clearFilters = useCallback(() => {
    setServiceFilter('')
    setStatusFilter('')
    setSearchQuery('')
  }, [])

  return {
    deployments,
    loading,
    refreshing,
    error,
    serviceFilter,
    setServiceFilter,
    statusFilter,
    setStatusFilter,
    searchQuery,
    setSearchQuery,
    expandedId,
    setExpandedId,
    stats,
    services,
    filtered,
    groupedByDate,
    fetchDeployments,
    clearFilters,
  }
}
