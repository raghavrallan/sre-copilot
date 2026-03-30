import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '../../../stores/auth-store'
import * as syntheticsApi from '../api'
import type { MonitorApi, SyntheticsMonitor, SyntheticsResult, SyntheticsResultApi } from '../types'

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

function mapMonitor(raw: MonitorApi): SyntheticsMonitor {
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

function mapResult(raw: SyntheticsResultApi): SyntheticsResult {
  return {
    timestamp: new Date(raw.timestamp).toLocaleTimeString(),
    status: raw.success ? 'pass' : 'fail',
    responseTime: raw.response_time_ms ?? 0,
    statusCode: raw.status_code ?? 0,
  }
}

export function useSynthetics() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [monitors, setMonitors] = useState<SyntheticsMonitor[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedResults, setExpandedResults] = useState<SyntheticsResult[]>([])
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
    if (!projectId) return
    const id = projectId
    let cancelled = false
    async function fetchMonitors() {
      setLoading(true)
      setError(null)
      try {
        const data = await syntheticsApi.fetchSyntheticsMonitors(id)
        if (!cancelled) {
          setMonitors(data.map(mapMonitor))
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg =
            err && typeof err === 'object' && 'response' in err
              ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
              : 'Failed to load monitors'
          setError(typeof msg === 'string' ? msg : 'Failed to load monitors')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchMonitors()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const fetchResults = useCallback(
    async (monitorId: string) => {
      if (!projectId) return
      setExpandedResultsLoading(true)
      setExpandedResults([])
      try {
        const res = await syntheticsApi.fetchSyntheticsMonitorResults(projectId, monitorId)
        setExpandedResults((res.items || []).map(mapResult))
      } catch {
        setExpandedResults([])
      } finally {
        setExpandedResultsLoading(false)
      }
    },
    [projectId]
  )

  const handleExpand = useCallback(
    (id: string) => {
      if (expandedId === id) {
        setExpandedId(null)
        setExpandedResults([])
      } else {
        setExpandedId(id)
        fetchResults(id)
      }
    },
    [expandedId, fetchResults]
  )

  const handleCreate = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      if (!projectId) return
      setCreateSubmitting(true)
      setCreateError(null)
      try {
        const data = await syntheticsApi.createSyntheticsMonitor({
          project_id: projectId,
          name: createForm.name,
          type: createForm.type,
          url: createForm.url,
          frequency_seconds: createForm.frequency_seconds,
          assertions: createForm.assertions,
          enabled: createForm.enabled,
        })
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
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Failed to create monitor'
        setCreateError(typeof msg === 'string' ? msg : 'Failed to create monitor')
      } finally {
        setCreateSubmitting(false)
      }
    },
    [projectId, createForm]
  )

  const chartData = expandedResults
    .slice(0, 20)
    .reverse()
    .map((r, i) => ({ time: `${i}`, rt: r.responseTime }))

  return {
    projectId,
    monitors,
    loading,
    error,
    expandedId,
    expandedResults,
    expandedResultsLoading,
    showCreateModal,
    setShowCreateModal,
    createSubmitting,
    createError,
    createForm,
    setCreateForm,
    fetchResults,
    handleExpand,
    handleCreate,
    chartData,
  }
}
