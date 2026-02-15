import { useEffect, useState } from 'react'
import api from '../../services/api'
import { useAuthStore } from '../../lib/stores/auth-store'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  Coins, Hash, Clock, CheckCircle2, AlertTriangle, TrendingDown,
  Lightbulb, Loader2, Zap, Cpu, ArrowDownRight, ArrowUpRight,
} from 'lucide-react'

interface IncidentMetrics {
  incident_id: string
  incident_title: string
  summary: {
    total_ai_requests: number
    total_analysis_steps: number
    total_cost_usd: number
    total_tokens: number
    total_input_tokens: number
    total_output_tokens: number
  }
  ai_requests: Array<{
    id: string
    request_type: string
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost_usd: number
    duration_ms: number
    model_used: string
    success: boolean
    created_at: string
  }>
  cost_breakdown: {
    input_cost_usd: number
    output_cost_usd: number
    total_cost_usd: number
  }
}

interface CostSummary {
  overall_stats?: {
    avg_cost_per_request: number
    total_cost_usd: number
    total_requests: number
  }
}

interface AICostAnalyticsProps {
  incidentId: string
}

const formatCost = (cost: number) => {
  if (cost === 0) return '$0.00'
  if (cost < 0.001) return `$${cost.toFixed(6)}`
  if (cost < 0.01) return `$${cost.toFixed(5)}`
  return `$${cost.toFixed(4)}`
}

const formatTokens = (tokens: number) => tokens.toLocaleString()

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

/** SVG gauge arc for efficiency metrics */
function GaugeArc({ value, max, color }: { value: number; max: number; color: string }) {
  const ratio = Math.min(value / max, 1)
  return (
    <div className="relative w-24 h-12 overflow-hidden">
      <svg viewBox="0 0 100 50" className="w-full h-full">
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="#e5e7eb" strokeWidth="8" strokeLinecap="round" />
        <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={`${126 * ratio} 126`} />
      </svg>
    </div>
  )
}

export default function AICostAnalytics({ incidentId }: AICostAnalyticsProps) {
  const { currentProject } = useAuthStore()
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null)
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [metricsRes, costRes] = await Promise.all([
          api.get(`/api/v1/incidents/${incidentId}/metrics`),
          api.get(`/api/v1/analytics/cost-summary?project_id=${currentProject?.id}`).catch(() => null),
        ])
        setMetrics(metricsRes.data)
        if (costRes) setCostSummary(costRes.data)
      } catch (err) {
        console.error('Failed to fetch AI cost metrics:', err)
        setError('Failed to load AI cost data')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [incidentId, currentProject])

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading AI cost analytics...</span>
        </div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <Coins className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{error || 'No cost data available'}</p>
      </div>
    )
  }

  const { summary, ai_requests, cost_breakdown } = metrics
  const successCount = ai_requests.filter((r) => r.success).length
  const successRate = ai_requests.length > 0 ? Math.round((successCount / ai_requests.length) * 100) : 0
  const avgDuration = ai_requests.length > 0
    ? Math.round(ai_requests.reduce((sum, r) => sum + r.duration_ms, 0) / ai_requests.length) : 0

  const costPerStep = summary.total_analysis_steps > 0 ? summary.total_cost_usd / summary.total_analysis_steps : 0
  const avgCostPerRequest = costSummary?.overall_stats?.avg_cost_per_request || 0
  const thisAvgCost = ai_requests.length > 0 ? summary.total_cost_usd / ai_requests.length : 0
  const costDiffPercent = avgCostPerRequest > 0
    ? Math.round(((thisAvgCost - avgCostPerRequest) / avgCostPerRequest) * 100) : 0

  // Request timeline (Gantt-like)
  const sortedRequests = [...ai_requests].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const timelineStart = sortedRequests.length > 0 ? new Date(sortedRequests[0].created_at).getTime() : 0
  const timelineEnd = sortedRequests.length > 0
    ? Math.max(...sortedRequests.map((r) => new Date(r.created_at).getTime() + r.duration_ms)) : 0
  const timelineSpan = timelineEnd - timelineStart || 1

  // Chart data
  const donutData = [
    { name: 'Input Cost', value: cost_breakdown.input_cost_usd, color: '#6366f1' },
    { name: 'Output Cost', value: cost_breakdown.output_cost_usd, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  const tokenBarData = ai_requests.map((r, i) => ({
    name: `R${i + 1}`, input: r.input_tokens, output: r.output_tokens,
  }))

  // Smart recommendations
  const recommendations: { icon: React.ReactNode; text: string; type: 'success' | 'warning' | 'info' }[] = []
  if (summary.total_output_tokens > summary.total_input_tokens * 3) {
    recommendations.push({ icon: <TrendingDown className="w-4 h-4" />, text: 'Output tokens are 3x input. Consider asking for more concise responses to reduce costs.', type: 'warning' })
  }
  if (successRate === 100 && ai_requests.length > 0) {
    recommendations.push({ icon: <CheckCircle2 className="w-4 h-4" />, text: 'All AI requests succeeded. Caching is working effectively.', type: 'success' })
  }
  if (successRate < 80 && ai_requests.length > 0) {
    recommendations.push({ icon: <AlertTriangle className="w-4 h-4" />, text: `${100 - successRate}% of requests failed. Check AI service health and API limits.`, type: 'warning' })
  }
  if (summary.total_cost_usd > 0.1) {
    recommendations.push({ icon: <Coins className="w-4 h-4" />, text: 'This incident exceeded $0.10 in AI costs. Review if all analysis steps were necessary.', type: 'warning' })
  }
  if (avgDuration > 5000) {
    recommendations.push({ icon: <Clock className="w-4 h-4" />, text: 'Average response time exceeds 5s. Consider using a faster model for initial triage.', type: 'info' })
  }
  if (recommendations.length === 0) {
    recommendations.push({ icon: <Zap className="w-4 h-4" />, text: 'AI cost metrics are within normal range. No optimization needed.', type: 'success' })
  }

  return (
    <div className="space-y-6">
      {/* Hero metrics strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center"><Coins className="w-4 h-4 text-purple-600" /></div>
            <span className="text-xs text-gray-500">Total Cost</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatCost(summary.total_cost_usd)}</p>
          {costDiffPercent !== 0 && (
            <div className={`flex items-center gap-1 mt-1 text-xs ${costDiffPercent > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {costDiffPercent > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(costDiffPercent)}% vs avg
            </div>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><Hash className="w-4 h-4 text-blue-600" /></div>
            <span className="text-xs text-gray-500">Total Tokens</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatTokens(summary.total_tokens)}</p>
          <p className="text-xs text-gray-400 mt-1">{formatTokens(summary.total_input_tokens)} in / {formatTokens(summary.total_output_tokens)} out</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center"><Clock className="w-4 h-4 text-orange-600" /></div>
            <span className="text-xs text-gray-500">Avg Response</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{formatDuration(avgDuration)}</p>
          <p className="text-xs text-gray-400 mt-1">{summary.total_ai_requests} requests</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-4 h-4 text-green-600" /></div>
            <span className="text-xs text-gray-500">Success Rate</span>
          </div>
          <p className="text-xl font-bold text-gray-900">{successRate}%</p>
          <p className="text-xs text-gray-400 mt-1">{successCount}/{ai_requests.length} succeeded</p>
        </div>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Cost Breakdown</h3>
          {donutData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={4} dataKey="value">
                    {donutData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCost(value)} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {donutData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <div>
                      <p className="text-xs text-gray-500">{d.name}</p>
                      <p className="text-sm font-semibold text-gray-900">{formatCost(d.value)}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-sm font-bold text-gray-900">{formatCost(cost_breakdown.total_cost_usd)}</p>
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-gray-400 text-center py-8">No cost data</p>}
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Token Usage by Request</h3>
          {tokenBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={tokenBarData} barSize={20}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: '12px', borderRadius: '8px' }} formatter={(value: number) => formatTokens(value)} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="input" stackId="a" fill="#6366f1" name="Input" />
                <Bar dataKey="output" stackId="a" fill="#f59e0b" name="Output" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No token data</p>}
        </div>
      </div>

      {/* Request Timeline (Gantt-like) */}
      {sortedRequests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-500" /> Request Timeline
          </h3>
          <div className="space-y-2">
            {sortedRequests.map((req, idx) => {
              const startOffset = new Date(req.created_at).getTime() - timelineStart
              const leftPercent = (startOffset / timelineSpan) * 100
              const widthPercent = Math.max((req.duration_ms / timelineSpan) * 100, 1.5)
              return (
                <div key={req.id} className="flex items-center gap-3">
                  <div className="w-20 flex-shrink-0 text-right">
                    <span className="text-xs font-medium text-gray-600 truncate block">R{idx + 1}</span>
                    <span className="text-[10px] text-gray-400">{formatDuration(req.duration_ms)}</span>
                  </div>
                  <div className="flex-1 relative h-7 bg-gray-50 rounded-md overflow-hidden border border-gray-100">
                    <div
                      className={`absolute top-1 bottom-1 rounded ${
                        req.success
                          ? req.duration_ms < 2000 ? 'bg-gradient-to-r from-green-400 to-green-500'
                            : req.duration_ms < 5000 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                            : 'bg-gradient-to-r from-red-400 to-red-500'
                          : 'bg-gradient-to-r from-red-300 to-red-400'
                      } transition-all duration-300`}
                      style={{ left: `${leftPercent}%`, width: `${widthPercent}%` }}
                      title={`${req.request_type} - ${formatDuration(req.duration_ms)} - ${formatCost(req.cost_usd)}`}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold text-white truncate px-1">
                        {widthPercent > 8 ? req.request_type : ''}
                      </span>
                    </div>
                  </div>
                  <div className="w-16 flex-shrink-0 text-right">
                    <span className="text-xs font-semibold text-purple-700">{formatCost(req.cost_usd)}</span>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between mt-2 ml-[92px] mr-[76px] text-[10px] text-gray-400">
            <span>0s</span>
            <span>{formatDuration(Math.round(timelineSpan / 2))}</span>
            <span>{formatDuration(timelineSpan)}</span>
          </div>
        </div>
      )}

      {/* Cost Efficiency with gauge */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-gray-500" /> Cost Efficiency
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-3">Cost per Step</p>
            <GaugeArc value={costPerStep} max={0.1} color={costPerStep < 0.01 ? '#22c55e' : costPerStep < 0.05 ? '#f59e0b' : '#ef4444'} />
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCost(costPerStep)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-3">Cost per Request</p>
            <GaugeArc value={thisAvgCost} max={0.1} color={thisAvgCost < 0.01 ? '#22c55e' : thisAvgCost < 0.05 ? '#f59e0b' : '#ef4444'} />
            <p className="text-lg font-bold text-gray-900 mt-1">{formatCost(thisAvgCost)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center">
            <p className="text-xs text-gray-500 mb-3">Tokens per Request</p>
            <GaugeArc
              value={ai_requests.length > 0 ? summary.total_tokens / ai_requests.length : 0}
              max={10000}
              color={ai_requests.length > 0 ? (summary.total_tokens / ai_requests.length < 1000 ? '#22c55e' : summary.total_tokens / ai_requests.length < 5000 ? '#f59e0b' : '#ef4444') : '#e5e7eb'}
            />
            <p className="text-lg font-bold text-gray-900 mt-1">
              {ai_requests.length > 0 ? formatTokens(Math.round(summary.total_tokens / ai_requests.length)) : '-'}
            </p>
          </div>
        </div>
      </div>

      {/* AI Request cards */}
      {ai_requests.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">AI Request History</h3>
          <div className="space-y-3">
            {ai_requests.map((req) => (
              <div key={req.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${req.success ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{req.request_type}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-mono">{req.model_used}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span>{formatTokens(req.total_tokens)} tokens</span>
                    <span className="text-gray-300">|</span>
                    <span>{formatTokens(req.input_tokens)} in / {formatTokens(req.output_tokens)} out</span>
                  </div>
                </div>
                <div className="hidden md:flex flex-col items-end gap-1 flex-shrink-0 w-24">
                  <span className="text-xs font-medium text-gray-700">{formatDuration(req.duration_ms)}</span>
                  <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${req.duration_ms < 2000 ? 'bg-green-400' : req.duration_ms < 5000 ? 'bg-yellow-400' : 'bg-red-400'}`}
                      style={{ width: `${Math.min(100, (req.duration_ms / 10000) * 100)}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-purple-700">{formatCost(req.cost_usd)}</p>
                  <p className="text-xs text-gray-400">{timeAgo(req.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Smart recommendations */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500" /> Smart Recommendations
        </h3>
        <div className="space-y-2">
          {recommendations.map((rec, i) => (
            <div key={i} className={`flex items-start gap-2.5 p-3 rounded-lg text-sm ${
              rec.type === 'success' ? 'bg-green-50 text-green-800' : rec.type === 'warning' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
            }`}>
              <span className="flex-shrink-0 mt-0.5">{rec.icon}</span>
              <span>{rec.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
