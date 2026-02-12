import { useParams, Link } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import StackTrace from '../components/errors/StackTrace'
import TriagePanel, { ErrorGroup } from '../components/errors/TriagePanel'
import api from '../services/api'

interface OccurrenceApi {
  timestamp: string
  attributes?: Record<string, string>
  stack_trace?: string
}

interface ErrorGroupApi {
  fingerprint: string
  service_name: string
  error_class: string
  message: string
  occurrence_count: number
  first_seen: string
  last_seen: string
  status: 'unresolved' | 'investigating' | 'resolved' | 'ignored'
  assignee: string | null
  notes: string | null
  occurrences?: OccurrenceApi[]
  stack_trace?: string
}

interface ErrorGroupDisplay extends ErrorGroup {
  stackTrace: string
  occurrenceTimeline: Array<{ time: string; count: number }>
  recentOccurrences: Array<{
    timestamp: string
    attributes: Record<string, string>
    stackTracePreview: string
  }>
  errorProfiles: Array<{ attribute: string; value: string; count: number }>
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

function mapApiToDisplay(api: ErrorGroupApi): ErrorGroupDisplay {
  const occurrences = api.occurrences ?? []
  const stackTrace =
    api.stack_trace ??
    occurrences.find((o) => o.stack_trace)?.stack_trace ??
    `${api.error_class}: ${api.message}\n  (No stack trace available)`
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
    fingerprint: api.fingerprint,
    errorClass: api.error_class,
    normalizedMessage: api.message,
    status: api.status,
    assignee: api.assignee ?? undefined,
    notes: api.notes ?? undefined,
    stackTrace,
    occurrenceTimeline: occurrencesToTimeline(occurrences),
    recentOccurrences,
    errorProfiles: errorProfiles.slice(0, 20),
  }
}

export default function ErrorGroupDetailPage() {
  const { fingerprint } = useParams<{ fingerprint: string }>()
  const [errorGroup, setErrorGroup] = useState<ErrorGroupDisplay | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchErrorGroup = useCallback(async () => {
    if (!fingerprint) return
    setLoading(true)
    setError(null)
    try {
      const response = await api.get<ErrorGroupApi>(
        `/api/v1/errors/groups/${encodeURIComponent(fingerprint)}`
      )
      setErrorGroup(mapApiToDisplay(response.data))
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
        await api.patch(`/api/v1/errors/groups/${encodeURIComponent(fingerprint)}/triage`, {
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

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-4">
          <div className="h-4 bg-gray-700 rounded w-48 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-gray-800 rounded-lg p-6 animate-pulse h-48" />
            <div className="bg-gray-800 rounded-lg p-6 animate-pulse h-48" />
          </div>
          <div className="bg-gray-800 rounded-lg p-6 animate-pulse h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/errors" className="hover:text-white">
              Errors
            </Link>
            <span>/</span>
            <span className="text-gray-500">{fingerprint}</span>
          </nav>
        </div>
        <div className="bg-gray-800 rounded-lg border border-red-900/50 p-12 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchErrorGroup}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!errorGroup) {
    return (
      <div className="px-4 sm:px-0">
        <div className="mb-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <Link to="/errors" className="hover:text-white">
              Errors
            </Link>
          </nav>
        </div>
        <div className="bg-gray-800 rounded-lg p-12 text-center text-gray-400">
          Error group not found
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-4">
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link to="/errors" className="hover:text-white">
            Errors
          </Link>
          <span>/</span>
          <span className="text-white">{errorGroup.errorClass}</span>
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Stack Trace</h2>
            <StackTrace stackTrace={errorGroup.stackTrace} />
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Occurrences Timeline</h2>
            {errorGroup.occurrenceTimeline.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={errorGroup.occurrenceTimeline}>
                    <XAxis dataKey="time" stroke="#9ca3af" fontSize={11} />
                    <YAxis stroke="#9ca3af" fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #4b5563' }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-500">
                No occurrence data
              </div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Recent Occurrences</h2>
            {errorGroup.recentOccurrences.length > 0 ? (
              <div className="space-y-3">
                {errorGroup.recentOccurrences.map((occ, i) => (
                  <div
                    key={i}
                    className="rounded-lg bg-gray-900/50 p-3 border border-gray-700/50"
                  >
                    <span className="text-xs text-gray-500">
                      {new Date(occ.timestamp).toLocaleString()}
                    </span>
                    {Object.keys(occ.attributes).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(occ.attributes).map(([k, v]) => (
                          <span
                            key={k}
                            className="text-xs px-2 py-1 rounded bg-gray-700/60 text-gray-400"
                          >
                            {k}={v}
                          </span>
                        ))}
                      </div>
                    )}
                    {occ.stackTracePreview && (
                      <p className="mt-2 font-mono text-xs text-gray-500 truncate">
                        {occ.stackTracePreview}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500 py-4">No recent occurrences</div>
            )}
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Error Profiles</h2>
            {errorGroup.errorProfiles.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border border-gray-700/50">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-900/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                        Attribute
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                        Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-400 uppercase">
                        Count
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {errorGroup.errorProfiles.map((row) => (
                      <tr key={`${row.attribute}-${row.value}`}>
                        <td className="px-4 py-2 text-gray-300 font-mono">{row.attribute}</td>
                        <td className="px-4 py-2 text-gray-400">{row.value}</td>
                        <td className="px-4 py-2 text-gray-400">{row.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-500 py-4">No error profile data</div>
            )}
          </div>
        </div>

        <div>
          <TriagePanel errorGroup={errorGroup} onUpdate={handleTriageUpdate} />
        </div>
      </div>
    </div>
  )
}
