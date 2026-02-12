import { Span } from './TraceWaterfall'

interface SpanDetailProps {
  span: Span | null
}

export default function SpanDetail({ span }: SpanDetailProps) {
  if (!span) {
    return (
      <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-6 text-center text-gray-500">
        Select a span to view details
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 overflow-hidden">
      <div className="px-4 py-3 bg-gray-900/80 border-b border-gray-700/50">
        <h3 className="text-sm font-semibold text-white">Span Details</h3>
      </div>
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-gray-500 block">Operation</span>
            <span className="text-sm text-white font-medium">{span.operation}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Service</span>
            <span className="text-sm text-white font-medium">{span.service}</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Duration</span>
            <span className="text-sm text-white font-medium">{span.duration}ms</span>
          </div>
          <div>
            <span className="text-xs text-gray-500 block">Status</span>
            <span
              className={`text-sm font-medium ${
                span.status === 'ok' ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {span.status}
            </span>
          </div>
          <div className="col-span-2">
            <span className="text-xs text-gray-500 block">Span ID</span>
            <span className="text-xs font-mono text-gray-400">{span.spanId}</span>
          </div>
        </div>

        {span.attributes && Object.keys(span.attributes).length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Attributes
            </h4>
            <div className="rounded-lg bg-gray-900/50 overflow-hidden">
              <table className="min-w-full text-sm">
                <tbody className="divide-y divide-gray-700/50">
                  {Object.entries(span.attributes).map(([key, value]) => (
                    <tr key={key}>
                      <td className="px-4 py-2 text-gray-500 font-mono">{key}</td>
                      <td className="px-4 py-2 text-gray-300">{String(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {span.events && span.events.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Events
            </h4>
            <div className="space-y-2">
              {span.events.map((event, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 py-2 px-3 rounded bg-gray-900/50 text-sm"
                >
                  <span className="text-gray-500 font-mono text-xs">
                    +{event.timestamp - span.startTime}ms
                  </span>
                  <span className="text-white">{event.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(!span.attributes || Object.keys(span.attributes).length === 0) &&
          (!span.events || span.events.length === 0) && (
            <p className="text-sm text-gray-500">No additional attributes or events</p>
          )}
      </div>
    </div>
  )
}
