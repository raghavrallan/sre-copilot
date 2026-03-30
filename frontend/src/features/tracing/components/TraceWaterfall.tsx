import { useMemo } from 'react'

export interface Span {
  spanId: string
  traceId: string
  parentSpanId?: string
  operation: string
  service: string
  startTime: number
  duration: number
  status: 'ok' | 'error'
  attributes?: Record<string, string | number | boolean>
  events?: Array<{ name: string; timestamp: number }>
}

interface TraceWaterfallProps {
  spans: Span[]
  selectedSpanId?: string
  onSelectSpan?: (span: Span) => void
}

const SERVICE_COLORS: Record<string, string> = {
  gateway: 'bg-blue-500',
  auth: 'bg-green-500',
  postgres: 'bg-purple-500',
  api: 'bg-amber-500',
  redis: 'bg-red-500',
  default: 'bg-indigo-500',
}

function getServiceColor(service: string): string {
  const key = service.toLowerCase()
  return SERVICE_COLORS[key] ?? SERVICE_COLORS.default
}

export default function TraceWaterfall({ spans, selectedSpanId, onSelectSpan }: TraceWaterfallProps) {
  const { rootSpan, spanTree, totalDuration, minStart } = useMemo(() => {
    if (spans.length === 0) {
      return { rootSpan: null, spanTree: new Map<string, Span[]>(), totalDuration: 0, minStart: 0 }
    }
    const min = Math.min(...spans.map((s) => s.startTime))
    const max = Math.max(...spans.map((s) => s.startTime + s.duration))
    const total = max - min

    const root = spans.find((s) => !s.parentSpanId) ?? spans[0]
    const byParent = new Map<string, Span[]>()
    for (const s of spans) {
      const pid = s.parentSpanId ?? 'root'
      if (!byParent.has(pid)) byParent.set(pid, [])
      byParent.get(pid)!.push(s)
    }
    for (const arr of byParent.values()) {
      arr.sort((a, b) => a.startTime - b.startTime)
    }

    return {
      rootSpan: root,
      spanTree: byParent,
      totalDuration: total,
      minStart: min,
    }
  }, [spans])

  const renderSpan = (span: Span, depth: number) => {
    const offset = ((span.startTime - minStart) / totalDuration) * 100
    const width = Math.max((span.duration / totalDuration) * 100, 0.5)
    const isSelected = selectedSpanId === span.spanId
    const color = getServiceColor(span.service)
    const children = spanTree.get(span.spanId) ?? []

    return (
      <div key={span.spanId} className="min-w-0">
        <div
          className={`flex items-center gap-2 py-1.5 cursor-pointer rounded px-2 transition-colors ${
            isSelected ? 'bg-gray-700/80' : 'hover:bg-gray-700/50'
          }`}
          onClick={() => onSelectSpan?.(span)}
        >
          <div className="flex-shrink-0 w-48 flex items-center gap-2">
            <div
              className="flex-shrink-0 text-xs text-gray-500"
              style={{ paddingLeft: `${depth * 16}px` }}
            >
              {depth > 0 && '└ '}
            </div>
            <span className="text-sm font-medium text-white truncate">{span.service}</span>
            <span className="text-xs text-gray-400 truncate flex-1">{span.operation}</span>
          </div>
          <div className="flex-1 min-w-0 relative h-6 bg-gray-900/80 rounded">
            <div
              className={`absolute top-0.5 bottom-0.5 rounded ${color} ${span.status === 'error' ? 'ring-1 ring-red-400' : ''}`}
              style={{
                left: `${offset}%`,
                width: `${width}%`,
              }}
              title={`${span.duration}ms`}
            />
          </div>
          <span className="flex-shrink-0 text-xs text-gray-400 w-14 text-right">
            {span.duration}ms
          </span>
        </div>
        {children.map((child) => renderSpan(child, depth + 1))}
      </div>
    )
  }

  if (!rootSpan) {
    return (
      <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-8 text-center text-gray-500">
        No spans to display
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 overflow-hidden">
      <div className="px-4 py-2 bg-gray-900/80 border-b border-gray-700/50 flex items-center gap-2 text-xs text-gray-400">
        <span className="w-48">Service / Operation</span>
        <span className="flex-1">Timeline (0ms - {Math.round(totalDuration)}ms)</span>
        <span className="w-14 text-right">Duration</span>
      </div>
      <div className="p-2 max-h-96 overflow-y-auto">
        {renderSpan(rootSpan, 0)}
      </div>
    </div>
  )
}
