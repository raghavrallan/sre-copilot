import { useEffect, useState } from 'react'
import api from '../services/api'

interface TokenUsage {
  total_requests: number
  total_input_tokens: number
  total_output_tokens: number
  total_tokens: number
  total_cost_usd: number
  avg_duration_ms: number
  breakdown_by_type: Array<{
    request_type: string
    count: number
    input_tokens: number
    output_tokens: number
    total_tokens: number
    cost_usd: number
  }>
  timeline: Array<{
    date: string
    requests: number
    cost_usd: number
  }>
}

interface CostSummary {
  time_period_days: number
  overall_stats: {
    total_requests: number
    total_cost_usd: number
    total_tokens: number
    avg_cost_per_request: number
  }
  cache_stats: {
    total_incidents: number
    cache_hit_rate: number
    potential_savings: number
  }
  most_expensive_incidents: Array<{
    incident_id: string
    incident_title: string
    total_cost_usd: number
    total_requests: number
  }>
  recommendations: Array<{
    type: string
    message: string
    priority: string
  }>
}

export default function AnalyticsPage() {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null)
  const [costSummary, setCostSummary] = useState<CostSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(7)

  useEffect(() => {
    fetchAnalytics()
  }, [days])

  const fetchAnalytics = async () => {
    setLoading(true)
    try {
      const [usageResponse, summaryResponse] = await Promise.all([
        api.get('http://localhost:8003/analytics/token-usage'),
        api.get(`http://localhost:8003/analytics/cost-summary?days=${days}`)
      ])
      setTokenUsage(usageResponse.data)
      setCostSummary(summaryResponse.data)
    } catch (error) {
      console.error('Failed to fetch analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCost = (cost: number) => {
    if (cost < 0.01) return `$${cost.toFixed(6)}`
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString()
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Cost Analytics</h1>
        <div className="text-center py-8">Loading analytics...</div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Cost Analytics</h1>
          <p className="text-sm text-gray-600 mt-2">
            Monitor AI service costs, token usage, and optimization opportunities
          </p>
        </div>
        <div>
          <label className="text-sm text-gray-600 mr-2">Time Period:</label>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Overall Stats */}
      {costSummary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium mb-1">Total Requests</div>
            <div className="text-3xl font-bold text-blue-900">
              {costSummary.overall_stats.total_requests}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <div className="text-sm text-green-600 font-medium mb-1">Total Tokens</div>
            <div className="text-3xl font-bold text-green-900">
              {formatTokens(costSummary.overall_stats.total_tokens)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium mb-1">Total Cost</div>
            <div className="text-3xl font-bold text-purple-900">
              {formatCost(costSummary.overall_stats.total_cost_usd)}
            </div>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 border border-orange-200">
            <div className="text-sm text-orange-600 font-medium mb-1">Avg Cost/Request</div>
            <div className="text-3xl font-bold text-orange-900">
              {formatCost(costSummary.overall_stats.avg_cost_per_request)}
            </div>
          </div>
        </div>
      )}

      {/* Cache Stats */}
      {costSummary && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cache Performance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-sm text-gray-600">Total Incidents</div>
              <div className="text-2xl font-bold text-gray-900">
                {costSummary.cache_stats.total_incidents}
              </div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600">Cache Hit Rate</div>
              <div className="text-2xl font-bold text-green-900">
                {costSummary.cache_stats.cache_hit_rate.toFixed(1)}%
              </div>
              {costSummary.cache_stats.cache_hit_rate >= 80 && (
                <div className="text-xs text-green-600 mt-1">Excellent</div>
              )}
              {costSummary.cache_stats.cache_hit_rate < 80 && costSummary.cache_stats.cache_hit_rate >= 50 && (
                <div className="text-xs text-yellow-600 mt-1">Good</div>
              )}
              {costSummary.cache_stats.cache_hit_rate < 50 && (
                <div className="text-xs text-red-600 mt-1">Needs improvement</div>
              )}
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600">Potential Savings</div>
              <div className="text-2xl font-bold text-blue-900">
                {formatCost(costSummary.cache_stats.potential_savings)}
              </div>
              <div className="text-xs text-blue-600 mt-1">From cache hits</div>
            </div>
          </div>
        </div>
      )}

      {/* Token Usage by Type */}
      {tokenUsage && tokenUsage.breakdown_by_type.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Usage by Request Type</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Request Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Count
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Avg Cost
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tokenUsage.breakdown_by_type.map((item) => (
                  <tr key={item.request_type}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                      {item.request_type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {item.count}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatTokens(item.total_tokens)}
                      <div className="text-xs text-gray-400">
                        {formatTokens(item.input_tokens)} in / {formatTokens(item.output_tokens)} out
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCost(item.cost_usd)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {formatCost(item.cost_usd / item.count)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Most Expensive Incidents */}
      {costSummary && costSummary.most_expensive_incidents.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Most Expensive Incidents</h2>
          <div className="space-y-3">
            {costSummary.most_expensive_incidents.map((incident, index) => (
              <div key={incident.incident_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                      <a
                        href={`/incidents/${incident.incident_id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {incident.incident_title}
                      </a>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      {incident.total_requests} AI requests
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-purple-900">
                      {formatCost(incident.total_cost_usd)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCost(incident.total_cost_usd / incident.total_requests)} per request
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {costSummary && costSummary.recommendations.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Optimization Recommendations</h2>
          <div className="space-y-3">
            {costSummary.recommendations.map((rec, index) => (
              <div key={index} className={`border-2 rounded-lg p-4 ${getPriorityColor(rec.priority)}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="font-semibold text-sm uppercase mb-1">
                      {rec.priority} Priority
                    </div>
                    <div className="text-sm">{rec.message}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cost Timeline */}
      {tokenUsage && tokenUsage.timeline.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cost Timeline</h2>
          <div className="space-y-2">
            {tokenUsage.timeline.map((day) => (
              <div key={day.date} className="flex justify-between items-center py-2 border-b">
                <div className="text-sm text-gray-700">{day.date}</div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600">{day.requests} requests</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCost(day.cost_usd)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
