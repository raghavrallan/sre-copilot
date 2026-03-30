import { useState, useMemo, useEffect, useCallback } from 'react'
import * as tracingApi from '../api'
import type { ApiSpan, TraceSummary, TracingSortKey, TracingSortOrder } from '../types'
import type { Span } from '../components/TraceWaterfall'

function mapApiSpan(s: ApiSpan, idx: number, allSpans: ApiSpan[]): Span {
  const sorted = [...allSpans].sort((a, b) => (a.timestamp ?? '').localeCompare(b.timestamp ?? ''))
  const earliest = sorted[0]?.timestamp ? new Date(sorted[0].timestamp).getTime() : 0
  const thisTime = s.timestamp ? new Date(s.timestamp).getTime() : 0
  const startTime = earliest > 0 && thisTime > 0 ? thisTime - earliest : idx * 10

  return {
    spanId: s.span_id,
    traceId: s.trace_id,
    parentSpanId: s.parent_span_id ?? undefined,
    operation: s.operation,
    service: s.service_name,
    startTime,
    duration: s.duration_ms,
    status: s.status === 'ok' ? 'ok' : 'error',
    attributes: (s.attributes as Record<string, string>) ?? {},
    events: (s.events ?? []).map((e) => ({ name: e.name, timestamp: e.timestamp ?? 0 })),
  }
}

export function useTracing() {
  const [serviceFilter, setServiceFilter] = useState('')
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [timeRange, setTimeRange] = useState('Last 1h')
  const [sortKey, setSortKey] = useState<TracingSortKey>('duration')
  const [sortOrder, setSortOrder] = useState<TracingSortOrder>('desc')

  const [services, setServices] = useState<string[]>([])
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [servicesLoading, setServicesLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setServicesLoading(true)
    tracingApi
      .fetchMetricsServices()
      .then((list) => {
        if (!cancelled) setServices(list)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.response?.data?.detail ?? err.message ?? 'Failed to load services')
      })
      .finally(() => {
        if (!cancelled) setServicesLoading(false)
      })
    return () => {
      cancelled = true
    }
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

    tracingApi
      .fetchTraces(params)
      .then((list) => {
        if (!cancelled) setTraces(list)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.response?.data?.detail ?? err.message ?? 'Failed to load traces')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [serviceFilter, minDuration, maxDuration, statusFilter])

  const sortedTraces = useMemo(() => {
    return [...traces].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'duration') cmp = a.duration_ms - b.duration_ms
      else if (sortKey === 'spanCount') cmp = a.span_count - b.span_count
      else cmp = a.service_count - b.service_count
      return sortOrder === 'asc' ? cmp : -cmp
    })
  }, [traces, sortKey, sortOrder])

  const toggleSort = useCallback((key: TracingSortKey) => {
    setSortKey((prevKey) => {
      if (prevKey === key) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
        return prevKey
      }
      setSortOrder('desc')
      return key
    })
  }, [])

  return {
    serviceFilter,
    setServiceFilter,
    minDuration,
    setMinDuration,
    maxDuration,
    setMaxDuration,
    statusFilter,
    setStatusFilter,
    timeRange,
    setTimeRange,
    sortKey,
    sortOrder,
    toggleSort,
    services,
    traces: sortedTraces,
    rawTraces: traces,
    loading,
    error,
    servicesLoading,
  }
}

export function useTraceDetail(traceId: string | undefined) {
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null)
  const [spans, setSpans] = useState<Span[]>([])
  const [totalDuration, setTotalDuration] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!traceId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    tracingApi
      .fetchTrace(traceId)
      .then((data) => {
        if (cancelled) return
        const apiSpans = data.waterfall?.length ? data.waterfall : data.spans ?? []
        const mapped = apiSpans.map((s, i) => mapApiSpan(s, i, apiSpans))
        setSpans(mapped)
        setTotalDuration(data.total_duration_ms ?? 0)
      })
      .catch((err) => {
        if (!cancelled)
          setError(err.response?.data?.detail ?? err.message ?? 'Failed to load trace')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [traceId])

  const refetch = useCallback(async () => {
    if (!traceId) return
    setLoading(true)
    setError(null)
    try {
      const data = await tracingApi.fetchTrace(traceId)
      const apiSpans = data.waterfall?.length ? data.waterfall : data.spans ?? []
      const mapped = apiSpans.map((s, i) => mapApiSpan(s, i, apiSpans))
      setSpans(mapped)
      setTotalDuration(data.total_duration_ms ?? 0)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      setError(e.response?.data?.detail ?? e.message ?? 'Failed to load trace')
    } finally {
      setLoading(false)
    }
  }, [traceId])

  const rootSpan = spans.find((s) => !s.parentSpanId)
  const services = [...new Set(spans.map((s) => s.service))]
  const spanCount = spans.length
  const status = spans.some((s) => s.status === 'error') ? 'error' : 'ok'

  return {
    selectedSpan,
    setSelectedSpan,
    spans,
    totalDuration,
    loading,
    error,
    rootSpan,
    services,
    spanCount,
    status,
    refetch,
  }
}
