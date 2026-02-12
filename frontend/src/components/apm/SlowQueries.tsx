import { useState, Fragment } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

export interface SlowQuery {
  id: string
  queryPattern: string
  fullQuery?: string
  avgDuration: number
  callsPerMin: number
  totalTime: number
}

interface SlowQueriesProps {
  queries: SlowQuery[]
}

export default function SlowQueries({ queries }: SlowQueriesProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const truncate = (str: string, maxLen = 60) =>
    str.length <= maxLen ? str : str.slice(0, maxLen) + '...'

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/50 shadow-sm bg-gray-800/50">
      <table className="min-w-full divide-y divide-gray-700/50">
        <thead className="bg-gray-900/80">
          <tr>
            <th className="px-6 py-3 w-8"></th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Query Pattern
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Avg Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Calls/min
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Total Time
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50 bg-gray-800/30">
          {queries.map((q) => (
            <Fragment key={q.id}>
              <tr
                key={q.id}
                className="hover:bg-gray-700/50 cursor-pointer"
                onClick={() => (q.fullQuery ? toggleExpand(q.id) : undefined)}
              >
                <td className="px-6 py-4">
                  {q.fullQuery ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleExpand(q.id)
                      }}
                      className="text-gray-400 hover:text-white"
                    >
                      {expandedRows.has(q.id) ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  ) : (
                    <span className="w-4" />
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300 font-mono max-w-md truncate">
                  {truncate(q.queryPattern)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {q.avgDuration.toFixed(0)}ms
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {q.callsPerMin.toFixed(1)}
                </td>
                <td className="px-6 py-4 text-sm text-gray-300">
                  {q.totalTime >= 1000 ? `${(q.totalTime / 1000).toFixed(2)}s` : `${q.totalTime}ms`}
                </td>
              </tr>
              {expandedRows.has(q.id) && q.fullQuery && (
                <tr key={`${q.id}-expanded`} className="bg-gray-900/60">
                  <td colSpan={5} className="px-6 py-4">
                    <div className="text-xs font-mono text-gray-400 bg-gray-900/80 p-4 rounded border border-gray-700/50 overflow-x-auto whitespace-pre-wrap">
                      {q.fullQuery}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}
