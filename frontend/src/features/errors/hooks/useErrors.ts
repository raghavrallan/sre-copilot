import { useState, useEffect, useCallback, useMemo } from 'react'
import * as errorsApi from '../api'
import type {
  ErrorGroup,
  ErrorGroupApi,
  ErrorGroupDisplay,
  ErrorGroupItem,
  OccurrenceApi,
} from '../types'

function occurrencesToTrendData(
  occurrences?: Array<{ timestamp: string }>
): Array<{ time: string; count: number }> {
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

function occurrencesToTimeline(occurrences?: OccurrenceApi[]): Array<{ time: string; count: number }> {
  if (!occurrences || occurrences.length === 0) return []
  const buckets = new Map<string, number>()
  for (const o of occurrences) {
    const d = new Date(o.timestamp)
    const key = `${d.getHours()}:00`
    buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }
  return Array.from(buckets.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([time, count]) => ({ time, count }))
}

function mapApiToDisplay(apiData: ErrorGroupApi): ErrorGroupDisplay {
  const occurrences = apiData.occurrences ?? []
  const stackTrace =
    apiData.stack_trace ??
    occurrences.find((o) => o.stack_trace)?.stack_trace ??
    `${apiData.error_class}: ${apiData.message}\n  (No stack trace available)`
  const recentOccurrences = occurrences.slice(0, 10).map((o) => ({
    timestamp: o.timestamp,
    attributes: (o.attributes as Record<string, string>) ?? {},
    stackTracePreview: (o.stack_trace ?? '').split('\n')[0] ?? '',
  }))
  const attributeCounts = new Map<string, Map<string, number>>()
  for (const o of occurrences) {
    const attrs = o.attributes ?? {}
    for (const [k, v] of Object.entries(attrs)) {
      const val = String(v)
      if (!attributeCounts.has(k)) attributeCounts.set(k, new Map())
      const inner = attributeCounts.get(k)!
      inner.set(val, (inner.get(val) ?? 0) + 1)
    }
  }
  const errorProfiles: Array<{ attribute: string; value: string; count: number }> = []
  for (const [attr, inner] of attributeCounts) {
    for (const [value, count] of inner) {
      errorProfiles.push({ attribute: attr, value, count })
    }
  }
  errorProfiles.sort((a, b) => b.count - a.count)

  return {
    fingerprint: apiData.fingerprint,
    errorClass: apiData.error_class,
    normalizedMessage: apiData.message,
    status: apiData.status,
    assignee: apiData.assignee ?? undefined,
    notes: apiData.notes ?? undefined,
    stackTrace,
    occurrenceTimeline: occurrencesToTimeline(occurrences),
    recentOccurrences,
    errorProfiles: errorProfiles.slice(0, 20),
  }
}

export function useErrors() {
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
      const data = await errorsApi.fetchErrorGroups(params)
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

  const stats = useMemo(() => {
    const total = groups.length
    const unresolved = groups.filter((g) => g.status === 'unresolved').length
    const today = new Date().toDateString()
    const newToday = groups.filter(
      (g) => new Date(g.lastSeen).toDateString() === today && g.status !== 'resolved'
    ).length
    const regression = groups.filter(
      (g) => g.status === 'resolved' && new Date(g.lastSeen) > new Date(Date.now() - 86400000)
    ).length
    return { total, unresolved, newToday, regression }
  }, [groups])

  return {
    serviceFilter,
    setServiceFilter,
    statusFilter,
    setStatusFilter,
    timeRange,
    setTimeRange,
    groups,
    loading,
    error,
    services,
    fetchErrorGroups,
    stats,
  }
}

export function useErrorGroupDetail(fingerprint: string | undefined) {
  const [errorGroup, setErrorGroup] = useState<ErrorGroupDisplay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchErrorGroup = useCallback(async () => {
    if (!fingerprint) return
    setLoading(true)
    setError(null)
    try {
      const data = await errorsApi.fetchErrorGroupByFingerprint(fingerprint)
      setErrorGroup(mapApiToDisplay(data))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load error group')
      setErrorGroup(null)
    } finally {
      setLoading(false)
    }
  }, [fingerprint])

  useEffect(() => {
    fetchErrorGroup()
  }, [fetchErrorGroup])

  const handleTriageUpdate = useCallback(
    async (updates: Partial<ErrorGroup>) => {
      if (!fingerprint || !errorGroup) return
      try {
        await errorsApi.patchErrorGroupTriage(fingerprint, {
          status: updates.status,
          assignee: updates.assignee,
          notes: updates.notes,
        })
        setErrorGroup((prev) => (prev ? { ...prev, ...updates } : null))
      } catch (err) {
        console.error('Failed to update triage:', err)
      }
    },
    [fingerprint, errorGroup]
  )

  return {
    errorGroup,
    loading,
    error,
    fetchErrorGroup,
    handleTriageUpdate,
  }
}
