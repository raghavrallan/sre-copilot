/**
 * @deprecated Replaced by AICostAnalytics at components/incident/AICostAnalytics.tsx
 * This file is kept for reference only and is no longer imported.
 */
import { useEffect, useState } from 'react'
import api from '../../services/api'

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

interface MetricsPanelProps {
  incidentId: string
}

export default function MetricsPanel({ incidentId }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<IncidentMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await api.get(`/api/v1/incidents/${incidentId}/metrics`)
        setMetrics(response.data)
      } catch (err) {
        console.error('Failed to fetch metrics:', err)
        setError('Failed to load metrics')
      } finally {
        setLoading(false)
      }
    }

    fetchMetrics()
  }, [incidentId])

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 AI Cost Metrics</h2>
        <div className="text-center py-4 text-gray-500">Loading metrics...</div>
      </div>
    )
  }

  if (error || !metrics) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 AI Cost Metrics</h2>
        <div className="text-center py-4 text-red-500">{error || 'No metrics available'}</div>
      </div>
    )
  }

  const { summary, ai_requests, cost_breakdown } = metrics

  // Format cost with proper precision
  const formatCost = (cost: number) => {
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`
    }
    return `$${cost.toFixed(4)}`
  }

  // Format tokens with commas
  const formatTokens = (tokens: number) => {
    return tokens.toLocaleString()
  }

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">💰 AI Cost Metrics</h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600 font-medium">AI Requests</div>
          <div className="text-2xl font-bold text-blue-900">{summary.total_ai_requests}</div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="text-sm text-green-600 font-medium">Total Tokens</div>
          <div className="text-2xl font-bold text-green-900">{formatTokens(summary.total_tokens)}</div>
          <div className="text-xs text-green-600 mt-1">
            {formatTokens(summary.total_input_tokens)} in + {formatTokens(summary.total_output_tokens)} out
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600 font-medium">Total Cost</div>
          <div className="text-2xl font-bold text-purple-900">{formatCost(summary.total_cost_usd)}</div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4">
          <div className="text-sm text-orange-600 font-medium">Analysis Steps</div>
          <div className="text-2xl font-bold text-orange-900">{summary.total_analysis_steps}</div>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Cost Breakdown</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Input Tokens Cost:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCost(cost_breakdown.input_cost_usd)}
            </span>
          </div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-gray-600">Output Tokens Cost:</span>
            <span className="text-sm font-semibold text-gray-900">
              {formatCost(cost_breakdown.output_cost_usd)}
            </span>
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <span className="text-sm font-semibold text-gray-900">Total:</span>
            <span className="text-sm font-bold text-gray-900">
              {formatCost(cost_breakdown.total_cost_usd)}
            </span>
          </div>
        </div>
      </div>

      {/* AI Requests Table */}
      {ai_requests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Request History</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Model
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {ai_requests.map((request) => (
                  <tr key={request.id}>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {request.request_type}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      <div>{formatTokens(request.total_tokens)}</div>
                      <div className="text-xs text-gray-400">
                        {formatTokens(request.input_tokens)} in / {formatTokens(request.output_tokens)} out
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {formatCost(request.cost_usd)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {request.duration_ms}ms
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {request.model_used}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {request.success ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Success
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                          Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Optimization Tips */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Cost Optimization</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Caching is enabled - duplicate requests return cached results</li>
          <li>• Prompts are optimized to reduce token usage by 60%</li>
          <li>• All costs are tracked and can be monitored in real-time</li>
          {summary.total_cost_usd > 0.05 && (
            <li className="text-orange-700 font-semibold">
              ⚠️ This incident cost more than $0.05 - consider investigating
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
