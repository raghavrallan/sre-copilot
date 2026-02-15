import { useState, useMemo } from 'react'
import { Hypothesis } from '../../types/incident'
import {
  ChevronDown,
  ChevronUp,
  Brain,
  Trophy,
  Medal,
  Tag,
  SortAsc,
  Filter,
  Loader2,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

type HypothesisStatus = 'pending' | 'investigating' | 'confirmed' | 'rejected'

interface HypothesesPanelProps {
  hypotheses: Hypothesis[]
  isConnected: boolean
}

const STATUS_CONFIG: Record<HypothesisStatus, { label: string; bg: string; text: string; icon: React.ReactNode }> = {
  pending: { label: 'Pending', bg: 'bg-gray-100', text: 'text-gray-600', icon: null },
  investigating: { label: 'Investigating', bg: 'bg-blue-100', text: 'text-blue-700', icon: <Search className="w-3 h-3" /> },
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  rejected: { label: 'Rejected', bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3 h-3" /> },
}

function getRankIcon(rank: number) {
  if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />
  if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
  if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />
  return null
}

function getConfidenceColor(score: number) {
  if (score >= 0.6) return 'bg-green-500'
  if (score >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function getConfidenceTextColor(score: number) {
  if (score >= 0.6) return 'text-green-700'
  if (score >= 0.3) return 'text-yellow-700'
  return 'text-red-700'
}

export default function HypothesesPanel({ hypotheses, isConnected }: HypothesesPanelProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [statuses, setStatuses] = useState<Record<string, HypothesisStatus>>({})
  const [sortBy, setSortBy] = useState<'rank' | 'confidence'>('rank')
  const [filterStatus, setFilterStatus] = useState<HypothesisStatus | 'all'>('all')

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const setHypothesisStatus = (id: string, status: HypothesisStatus) => {
    setStatuses((prev) => ({ ...prev, [id]: status }))
  }

  const sortedAndFiltered = useMemo(() => {
    let result = [...hypotheses]
    if (filterStatus !== 'all') {
      result = result.filter((h) => (statuses[h.id] || 'pending') === filterStatus)
    }
    if (sortBy === 'confidence') {
      result.sort((a, b) => b.confidence_score - a.confidence_score)
    } else {
      result.sort((a, b) => a.rank - b.rank)
    }
    return result
  }, [hypotheses, sortBy, filterStatus, statuses])

  // Empty / loading state
  if (hypotheses.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-100 to-blue-100 animate-pulse" />
            <div className="relative w-full h-full flex items-center justify-center">
              <Brain className="w-8 h-8 text-purple-500" />
            </div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">AI is analyzing...</h3>
          <p className="text-sm text-gray-500 mb-4">
            Generating hypotheses for this incident. This usually takes a few seconds.
          </p>
          {isConnected && (
            <div className="inline-flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
              Real-time updates enabled
            </div>
          )}
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex gap-3 p-4 border border-gray-100 rounded-lg">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      {/* Header with sort/filter */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-900">AI Hypotheses</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{hypotheses.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSortBy(sortBy === 'rank' ? 'confidence' : 'rank')}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <SortAsc className="w-3.5 h-3.5" />
              {sortBy === 'rank' ? 'By Rank' : 'By Confidence'}
            </button>
            <div className="relative">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as HypothesisStatus | 'all')}
                className="appearance-none text-xs text-gray-500 bg-transparent border border-gray-200 rounded-md pl-6 pr-6 py-1 hover:border-gray-300 cursor-pointer"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="investigating">Investigating</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
              </select>
              <Filter className="absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Hypothesis list */}
      <div className="divide-y divide-gray-100">
        {sortedAndFiltered.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-400">No hypotheses match the selected filter.</div>
        ) : (
          sortedAndFiltered.map((h) => {
            const isExpanded = expandedIds.has(h.id)
            const status = statuses[h.id] || 'pending'
            const statusConfig = STATUS_CONFIG[status]
            const confidencePercent = Math.round(h.confidence_score * 100)

            return (
              <div key={h.id} className="group">
                <div
                  className="px-5 py-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                  onClick={() => toggleExpanded(h.id)}
                >
                  <div className="flex items-start gap-3">
                    {/* Rank badge */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                      h.rank <= 3 ? 'bg-gradient-to-br from-purple-100 to-blue-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {getRankIcon(h.rank) || <span>#{h.rank}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-sm font-semibold text-gray-900">{h.claim}</h3>
                        {/* Status chip with hover dropdown */}
                        <button onClick={(e) => e.stopPropagation()} className="relative group/status">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.text}`}>
                            {statusConfig.icon}
                            {statusConfig.label}
                          </span>
                          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-20 hidden group-hover/status:block min-w-[140px]">
                            {(Object.keys(STATUS_CONFIG) as HypothesisStatus[]).map((s) => (
                              <button
                                key={s}
                                onClick={(e) => { e.stopPropagation(); setHypothesisStatus(h.id, s) }}
                                className={`w-full text-left px-3 py-1.5 text-xs rounded-md hover:bg-gray-50 flex items-center gap-2 ${status === s ? 'font-semibold' : ''}`}
                              >
                                <span className={`w-2 h-2 rounded-full ${STATUS_CONFIG[s].bg.replace('100', '500')}`} />
                                {STATUS_CONFIG[s].label}
                              </button>
                            ))}
                          </div>
                        </button>
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{h.description}</p>
                      {/* Confidence bar */}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[200px]">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${getConfidenceColor(h.confidence_score)}`}
                            style={{ width: `${confidencePercent}%` }}
                          />
                        </div>
                        <span className={`text-xs font-semibold ${getConfidenceTextColor(h.confidence_score)}`}>
                          {confidencePercent}%
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 mt-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </div>

                {/* Expanded evidence */}
                {isExpanded && h.supporting_evidence.length > 0 && (
                  <div className="px-5 pb-4 pl-[4.5rem]">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Supporting Evidence</p>
                      <div className="flex flex-wrap gap-2">
                        {h.supporting_evidence.map((evidence, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1 text-xs bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg">
                            <Tag className="w-3 h-3 text-gray-400" />
                            {evidence}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
