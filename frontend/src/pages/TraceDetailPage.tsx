import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Span } from '../components/tracing/TraceWaterfall'
import TraceWaterfall from '../components/tracing/TraceWaterfall'
import SpanDetail from '../components/tracing/SpanDetail'
import api from '../services/api'

interface ApiSpan {
  trace_id: string
  span_id: string
  parent_span_id?: string | null
  service_name: string
  operation: string
  duration_ms: number
  status: string
  attributes?: Record<string, unknown>
  events?: Array<{ name: string; timestamp?: number }>
  timestamp?: string
}

interface TraceResponse {
  trace_id: string
  spans: ApiSpan[]
  total_duration_ms: number
  waterfall?: ApiSpan[]
}

function mapApiSpan(s: ApiSpan, idx: number, allSpans: ApiSpan[]): Span {
  // Calculate startTime relative to earliest span
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
    events: (s.events ?? []).map(e => ({ name: e.name, timestamp: e.timestamp ?? 0 })),
  }
}

export default function TraceDetailPage() {
  const { traceId } = useParams<{ traceId: string }>()
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

    api.get<TraceResponse>(`/api/v1/traces/${traceId}`)
      .then((res) => {
        if (cancelled) return
        const data = res.data
        const apiSpans = data.waterfall?.length ? data.waterfall : data.spans ?? []
        const mapped = apiSpans.map((s, i) => mapApiSpan(s, i, apiSpans))
        setSpans(mapped)
        setTotalDuration(data.total_duration_ms ?? 0)
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.detail ?? err.message ?? 'Failed to load trace')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [traceId])

  const rootSpan = spans.find((s) => !s.parentSpanId)
  const services = [...new Set(spans.map((s) => s.service))]
  const spanCount = spans.length
  const status = spans.some((s) => s.status === 'error') ? 'error' : 'ok'

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/tracing" className="hover:text-white">Tracing</Link>
            <span>/</span>
            <span className="text-white font-mono">{traceId}</span>
          </nav>
        </div>
        <div className="py-12 text-center text-gray-400">Loading trace...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/tracing" className="hover:text-white">Tracing</Link>
            <span>/</span>
            <span className="text-white font-mono">{traceId}</span>
          </nav>
        </div>
        <div className="py-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-4">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link to="/tracing" className="hover:text-white">
            Tracing
          </Link>
          <span>/</span>
          <span className="text-white font-mono">{traceId}</span>
        </nav>
      </div>

      <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Duration</span>
          <p className="text-xl font-bold text-white">{rootSpan ? rootSpan.duration : totalDuration}ms</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Services</span>
          <p className="text-xl font-bold text-white">{services.length}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Span Count</span>
          <p className="text-xl font-bold text-white">{spanCount}</p>
        </div>
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
          <span className="text-xs text-gray-500 uppercase">Status</span>
          <p className={`text-xl font-bold ${status === 'ok' ? 'text-green-400' : 'text-red-400'}`}>
            {status}
          </p>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">
          Service Map
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {services.map((s, i) => (
            <span key={s} className="flex items-center gap-2">
              {i > 0 && <span className="text-gray-500">→</span>}
              <span className="px-3 py-1 rounded-lg text-sm font-medium bg-gray-700/60 text-gray-300 border border-gray-600/50">
                {s}
              </span>
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TraceWaterfall
            spans={spans}
            selectedSpanId={selectedSpan?.spanId}
            onSelectSpan={setSelectedSpan}
          />
        </div>
        <div>
          <SpanDetail span={selectedSpan} />
        </div>
      </div>
    </div>
  )
}
