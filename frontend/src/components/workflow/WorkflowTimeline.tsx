/**
 * @deprecated Replaced by WorkflowPipeline at components/incident/WorkflowPipeline.tsx
 * This file is kept for reference only and is no longer imported.
 */
import { useEffect, useState } from 'react'
import api from '../../services/api'

interface WorkflowStep {
  id: string
  step_type: string
  step_type_display: string
  step_number: number
  status: string
  status_display: string
  input_tokens: number | null
  output_tokens: number | null
  total_tokens: number | null
  cost_usd: number | null
  duration_ms: number | null
  started_at: string | null
  completed_at: string | null
  error_message: string | null
}

interface WorkflowData {
  incident_id: string
  workflow_summary: {
    total_steps: number
    completed_steps: number
    failed_steps: number
    in_progress_steps: number
    total_cost_usd: number
    total_tokens: number
  }
  steps: WorkflowStep[]
}

interface WorkflowTimelineProps {
  incidentId: string
}

export default function WorkflowTimeline({ incidentId }: WorkflowTimelineProps) {
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const response = await api.get(`/api/v1/incidents/${incidentId}/workflow`)
        setWorkflow(response.data)
      } catch (err) {
        console.error('Failed to fetch workflow:', err)
        setError('Failed to load workflow')
      } finally {
        setLoading(false)
      }
    }

    fetchWorkflow()
  }, [incidentId])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return '✅'
      case 'in_progress':
        return '🔄'
      case 'failed':
        return '❌'
      case 'skipped':
        return '⏭️'
      case 'pending':
        return '⏳'
      default:
        return '⚪'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-300'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800 border-blue-300'
      case 'failed':
        return 'bg-red-100 text-red-800 border-red-300'
      case 'skipped':
        return 'bg-gray-100 text-gray-600 border-gray-300'
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300'
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatCost = (cost: number | null) => {
    if (!cost) return 'N/A'
    if (cost < 0.01) return `$${cost.toFixed(6)}`
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number | null) => {
    if (!tokens) return 'N/A'
    return tokens.toLocaleString()
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🔄 Analysis Workflow</h2>
        <div className="text-center py-4 text-gray-500">Loading workflow...</div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">🔄 Analysis Workflow</h2>
        <div className="text-center py-4 text-gray-500">
          {workflow?.steps.length === 0 ? 'No workflow steps yet' : error}
        </div>
      </div>
    )
  }

  const { workflow_summary, steps } = workflow

  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">🔄 Analysis Workflow Pipeline</h2>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-xs text-gray-600">Total Steps</div>
          <div className="text-xl font-bold text-gray-900">{workflow_summary.total_steps}</div>
        </div>
        <div className="bg-green-50 rounded-lg p-3">
          <div className="text-xs text-green-600">Completed</div>
          <div className="text-xl font-bold text-green-900">{workflow_summary.completed_steps}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-3">
          <div className="text-xs text-blue-600">In Progress</div>
          <div className="text-xl font-bold text-blue-900">{workflow_summary.in_progress_steps}</div>
        </div>
        <div className="bg-purple-50 rounded-lg p-3">
          <div className="text-xs text-purple-600">Total Cost</div>
          <div className="text-lg font-bold text-purple-900">
            {formatCost(workflow_summary.total_cost_usd)}
          </div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3">
          <div className="text-xs text-orange-600">Total Tokens</div>
          <div className="text-lg font-bold text-orange-900">
            {formatTokens(workflow_summary.total_tokens)}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-300"></div>

        {/* Steps */}
        <div className="space-y-4">
          {steps.map((step, index) => (
            <div key={step.id} className="relative pl-14">
              {/* Step indicator */}
              <div
                className={`absolute left-3 w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold border-2 ${getStatusColor(
                  step.status
                )}`}
                style={{ top: '0.5rem' }}
              >
                {step.step_number}
              </div>

              {/* Step content */}
              <div className={`border-2 rounded-lg p-4 ${getStatusColor(step.status)}`}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getStatusIcon(step.status)}</span>
                      <h3 className="font-semibold">{step.step_type_display}</h3>
                      <span
                        className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          step.status === 'completed'
                            ? 'bg-green-200 text-green-900'
                            : step.status === 'in_progress'
                            ? 'bg-blue-200 text-blue-900'
                            : step.status === 'failed'
                            ? 'bg-red-200 text-red-900'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {step.status_display}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 mt-1">{step.step_type}</div>
                  </div>

                  {/* Metrics */}
                  <div className="text-right text-sm">
                    {step.duration_ms && (
                      <div className="text-gray-700">
                        ⏱️ {formatDuration(step.duration_ms)}
                      </div>
                    )}
                    {step.cost_usd && (
                      <div className="text-purple-700 font-semibold">
                        💰 {formatCost(step.cost_usd)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Token usage */}
                {step.total_tokens && (
                  <div className="flex gap-4 text-xs text-gray-600 mt-2">
                    <div>
                      📊 Tokens: {formatTokens(step.total_tokens)}
                    </div>
                    {step.input_tokens && (
                      <div>In: {formatTokens(step.input_tokens)}</div>
                    )}
                    {step.output_tokens && (
                      <div>Out: {formatTokens(step.output_tokens)}</div>
                    )}
                  </div>
                )}

                {/* Timestamps */}
                {(step.started_at || step.completed_at) && (
                  <div className="flex gap-4 text-xs text-gray-500 mt-2">
                    {step.started_at && (
                      <div>
                        Started: {new Date(step.started_at).toLocaleTimeString()}
                      </div>
                    )}
                    {step.completed_at && (
                      <div>
                        Completed: {new Date(step.completed_at).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                )}

                {/* Error message */}
                {step.error_message && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    <strong>Error:</strong> {step.error_message}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info box */}
      {steps.length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-blue-900 mb-2">📋 Workflow Pipeline</h4>
          <p className="text-sm text-blue-700">
            This timeline shows each step of the incident analysis process. Steps are executed sequentially,
            with AI-powered analysis tracking token usage and costs in real-time.
          </p>
        </div>
      )}
    </div>
  )
}
