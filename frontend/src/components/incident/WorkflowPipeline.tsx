import { useEffect, useState } from 'react'
import api from '../../services/api'
import {
  Bell,
  Crosshair,
  Server,
  FileText,
  Search,
  Lightbulb,
  CheckCircle2,
  BarChart3,
  TrendingUp,
  AlertCircle,
  Loader2,
  Clock,
  Coins,
  Hash,
  ChevronUp,
  Zap,
} from 'lucide-react'

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

interface WorkflowPipelineProps {
  incidentId: string
}

const STEP_ICONS: Record<string, React.ElementType> = {
  alert_received: Bell,
  source_identified: Crosshair,
  platform_details: Server,
  logs_fetched: FileText,
  logs_analyzed: Search,
  hypothesis_generated: Lightbulb,
  solution_generated: CheckCircle2,
  metrics_fetched: BarChart3,
  metrics_analyzed: TrendingUp,
}

function getStepIcon(stepType: string) {
  return STEP_ICONS[stepType] || Zap
}

function getStatusStyles(status: string) {
  switch (status) {
    case 'completed':
      return { nodeBg: 'bg-green-500', nodeText: 'text-white', ring: 'ring-green-200', lineBg: 'bg-green-400', label: 'text-green-700', badgeBg: 'bg-green-100', badgeText: 'text-green-700' }
    case 'in_progress':
      return { nodeBg: 'bg-blue-500', nodeText: 'text-white', ring: 'ring-blue-200', lineBg: 'bg-blue-300', label: 'text-blue-700', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700' }
    case 'failed':
      return { nodeBg: 'bg-red-500', nodeText: 'text-white', ring: 'ring-red-200', lineBg: 'bg-red-300', label: 'text-red-700', badgeBg: 'bg-red-100', badgeText: 'text-red-700' }
    case 'skipped':
      return { nodeBg: 'bg-gray-300', nodeText: 'text-gray-600', ring: 'ring-gray-100', lineBg: 'bg-gray-200', label: 'text-gray-500', badgeBg: 'bg-gray-100', badgeText: 'text-gray-500' }
    default:
      return { nodeBg: 'bg-gray-200', nodeText: 'text-gray-500', ring: 'ring-gray-100', lineBg: 'bg-gray-200', label: 'text-gray-500', badgeBg: 'bg-gray-100', badgeText: 'text-gray-500' }
  }
}

const formatDuration = (ms: number | null) => {
  if (!ms) return '-'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

const formatCost = (cost: number | null) => {
  if (!cost) return '-'
  if (cost < 0.01) return `$${cost.toFixed(6)}`
  return `$${cost.toFixed(4)}`
}

const formatTokens = (tokens: number | null) => {
  if (!tokens) return '-'
  return tokens.toLocaleString()
}

export default function WorkflowPipeline({ incidentId }: WorkflowPipelineProps) {
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

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

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8">
        <div className="flex items-center justify-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading pipeline...</span>
        </div>
      </div>
    )
  }

  if (error || !workflow) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-500">{workflow?.steps.length === 0 ? 'No workflow steps yet' : error}</p>
      </div>
    )
  }

  const { workflow_summary, steps } = workflow
  const completionRate = workflow_summary.total_steps > 0
    ? Math.round((workflow_summary.completed_steps / workflow_summary.total_steps) * 100)
    : 0

  return (
    <div className="bg-white border border-gray-200 rounded-xl">
      {/* Progress bar and summary strip */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-500" />
            <h2 className="text-base font-semibold text-gray-900">Analysis Pipeline</h2>
          </div>
          <span className="text-sm font-semibold text-gray-700">
            {workflow_summary.completed_steps}/{workflow_summary.total_steps} steps &mdash; {completionRate}%
          </span>
        </div>

        <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>

        {/* Summary strip */}
        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span><strong className="text-gray-700">{workflow_summary.completed_steps}</strong> completed</span>
          </div>
          {workflow_summary.in_progress_steps > 0 && (
            <div className="flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              <span><strong className="text-gray-700">{workflow_summary.in_progress_steps}</strong> in progress</span>
            </div>
          )}
          {workflow_summary.failed_steps > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-500" />
              <span><strong className="text-gray-700">{workflow_summary.failed_steps}</strong> failed</span>
            </div>
          )}
          <div className="h-3 w-px bg-gray-200" />
          <div className="flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-purple-500" />
            <span>{formatCost(workflow_summary.total_cost_usd)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hash className="w-3.5 h-3.5 text-orange-500" />
            <span>{formatTokens(workflow_summary.total_tokens)} tokens</span>
          </div>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="px-5 py-6">
        {/* Desktop: horizontal pipeline */}
        <div className="hidden md:block overflow-x-auto">
          <div className="flex items-start gap-0 min-w-max">
            {steps.map((step, index) => {
              const styles = getStatusStyles(step.status)
              const Icon = getStepIcon(step.step_type)
              const isExpanded = expandedStep === step.id
              const isLast = index === steps.length - 1

              return (
                <div key={step.id} className="flex items-start">
                  <div className="flex flex-col items-center" style={{ minWidth: '100px' }}>
                    <button
                      onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                      className={`relative w-12 h-12 rounded-full ${styles.nodeBg} ${styles.nodeText} flex items-center justify-center ring-4 ${styles.ring} transition-all hover:scale-110 cursor-pointer`}
                    >
                      <Icon className="w-5 h-5" />
                      {step.status === 'in_progress' && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />
                      )}
                      {step.status === 'failed' && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">!</span>
                      )}
                    </button>
                    <p className={`text-xs font-medium mt-2 text-center max-w-[90px] leading-tight ${styles.label}`}>
                      {step.step_type_display}
                    </p>
                    <span className={`text-[10px] mt-0.5 px-1.5 py-0.5 rounded-full ${styles.badgeBg} ${styles.badgeText}`}>
                      {step.status_display}
                    </span>
                    {step.duration_ms && (
                      <span className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatDuration(step.duration_ms)}
                      </span>
                    )}
                  </div>
                  {!isLast && (
                    <div className="flex items-center pt-6">
                      <div className={`h-0.5 w-8 ${step.status === 'completed' ? styles.lineBg : 'bg-gray-200'} transition-all duration-500`} />
                      <div className={`w-0 h-0 border-t-[4px] border-t-transparent border-b-[4px] border-b-transparent border-l-[6px] ${step.status === 'completed' ? 'border-l-green-400' : 'border-l-gray-200'}`} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Mobile: vertical stacked pipeline */}
        <div className="md:hidden space-y-0">
          {steps.map((step, index) => {
            const styles = getStatusStyles(step.status)
            const Icon = getStepIcon(step.step_type)
            const isExpanded = expandedStep === step.id
            const isLast = index === steps.length - 1

            return (
              <div key={step.id}>
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="flex items-center gap-3 w-full text-left py-2 group"
                >
                  <div className={`relative w-10 h-10 rounded-full ${styles.nodeBg} ${styles.nodeText} flex items-center justify-center ring-4 ${styles.ring} flex-shrink-0 transition-all group-hover:scale-110`}>
                    <Icon className="w-4 h-4" />
                    {step.status === 'in_progress' && <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-ping" />}
                    {step.status === 'failed' && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[8px] font-bold">!</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${styles.label}`}>{step.step_type_display}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${styles.badgeBg} ${styles.badgeText}`}>{step.status_display}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                      {step.duration_ms && <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />{formatDuration(step.duration_ms)}</span>}
                      {step.cost_usd && <span>{formatCost(step.cost_usd)}</span>}
                      {step.total_tokens && <span>{formatTokens(step.total_tokens)} tokens</span>}
                    </div>
                  </div>
                </button>
                {!isLast && (
                  <div className="flex items-center ml-5">
                    <div className={`w-0.5 h-4 ${step.status === 'completed' ? styles.lineBg : 'bg-gray-200'} transition-all duration-500`} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Expanded step detail panel */}
      {expandedStep && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
          {(() => {
            const step = steps.find((s) => s.id === expandedStep)
            if (!step) return null
            const styles = getStatusStyles(step.status)
            const Icon = getStepIcon(step.step_type)

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${styles.nodeBg} ${styles.nodeText} flex items-center justify-center`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900">{step.step_type_display}</h4>
                      <p className="text-xs text-gray-500">Step {step.step_number} of {steps.length}</p>
                    </div>
                  </div>
                  <button onClick={() => setExpandedStep(null)} className="p-1 hover:bg-gray-200 rounded-md">
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Duration</p>
                    <p className="text-sm font-semibold text-gray-900">{formatDuration(step.duration_ms)}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Cost</p>
                    <p className="text-sm font-semibold text-purple-700">{formatCost(step.cost_usd)}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Total Tokens</p>
                    <p className="text-sm font-semibold text-gray-900">{formatTokens(step.total_tokens)}</p>
                  </div>
                  <div className="bg-white rounded-lg border border-gray-200 p-3">
                    <p className="text-xs text-gray-500 mb-0.5">I/O Tokens</p>
                    <p className="text-sm font-semibold text-gray-900">{formatTokens(step.input_tokens)} / {formatTokens(step.output_tokens)}</p>
                  </div>
                </div>

                {(step.started_at || step.completed_at) && (
                  <div className="flex gap-4 mt-3 text-xs text-gray-500">
                    {step.started_at && <span>Started: {new Date(step.started_at).toLocaleString()}</span>}
                    {step.completed_at && <span>Completed: {new Date(step.completed_at).toLocaleString()}</span>}
                  </div>
                )}
                {step.error_message && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                    <strong>Error:</strong> {step.error_message}
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
