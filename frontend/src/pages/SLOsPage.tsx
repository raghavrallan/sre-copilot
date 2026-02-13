import { useState, useEffect } from 'react'
import { Target, Plus, Loader2, AlertCircle } from 'lucide-react'
import api from '../services/api'

interface SLOApi {
  slo_id: string
  name: string
  service_name: string
  sli_type: string
  target_percentage: number
  time_window_days: number
  description?: string
  current_compliance: number
  error_budget_remaining: number
  burn_rate: number
}

interface SLO {
  id: string
  name: string
  service: string
  target: number
  current: number
  errorBudgetRemaining: number
  burnRate: number
  timeWindow: string
  status: 'meeting' | 'at_risk' | 'breached'
  description?: string
}

function mapApiToSLO(raw: SLOApi): SLO {
  const status: SLO['status'] =
    raw.current_compliance >= raw.target_percentage
      ? 'meeting'
      : raw.error_budget_remaining <= 0
        ? 'breached'
        : raw.error_budget_remaining < 20
          ? 'at_risk'
          : 'meeting'
  return {
    id: raw.slo_id,
    name: raw.name,
    service: raw.service_name,
    target: raw.target_percentage,
    current: raw.current_compliance,
    errorBudgetRemaining: raw.error_budget_remaining,
    burnRate: raw.burn_rate,
    timeWindow: `${raw.time_window_days}d`,
    status,
    description: raw.description,
  }
}

const SERVICES = ['api-gateway', 'auth-service', 'incident-service', 'ai-service', 'websocket-service']

export default function SLOsPage() {
  const [slos, setSlos] = useState<SLO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState({
    name: '',
    service_name: SERVICES[0],
    sli_type: 'availability',
    target_percentage: 99.9,
    time_window_days: 30,
    description: '',
  })

  useEffect(() => {
    let cancelled = false
    async function fetchSlos() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<SLOApi[]>('/api/v1/slos')
        if (!cancelled) {
          setSlos((data || []).map(mapApiToSLO))
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Failed to load SLOs'
          setError(typeof msg === 'string' ? msg : 'Failed to load SLOs')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSlos()
    return () => { cancelled = true }
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const { data } = await api.post<SLOApi>('/api/v1/slos', createForm)
      setSlos((prev) => [mapApiToSLO(data), ...prev])
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        service_name: SERVICES[0],
        sli_type: 'availability',
        target_percentage: 99.9,
        time_window_days: 30,
        description: '',
      })
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : 'Failed to create SLO'
      setCreateError(typeof msg === 'string' ? msg : 'Failed to create SLO')
    } finally {
      setCreateSubmitting(false)
    }
  }

  const getStatusColor = (status: SLO['status']) => {
    switch (status) {
      case 'meeting': return 'bg-green-500/20 text-green-400 border-green-500/50'
      case 'at_risk': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50'
      case 'breached': return 'bg-red-500/20 text-red-400 border-red-500/50'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  const getStatusLabel = (status: SLO['status']) => {
    switch (status) {
      case 'meeting': return 'Meeting'
      case 'at_risk': return 'At Risk'
      case 'breached': return 'Breached'
      default: return status
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0 flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 sm:px-0">
        <div className="flex items-center gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          <AlertCircle className="w-6 h-6 flex-shrink-0" />
          <p>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Target className="w-8 h-8 text-blue-400" />
          Service Level Objectives
        </h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create SLO
        </button>
      </div>

      <div className="space-y-4">
        {slos.length === 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-12 text-center text-gray-400">
            No SLOs found. Create one to get started.
          </div>
        ) : (
          slos.map((slo) => (
            <div
              key={slo.id}
              className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden"
            >
              <div
                onClick={() => setExpandedId(expandedId === slo.id ? null : slo.id)}
                className="p-6 cursor-pointer hover:bg-gray-700/30 transition-colors"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 rounded-lg bg-gray-700/50">
                      <Target className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{slo.name}</h3>
                      <p className="text-sm text-gray-400">{slo.service}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(slo.status)}`}>
                      {getStatusLabel(slo.status)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-8 text-sm">
                    <div>
                      <span className="text-gray-400 block">Target</span>
                      <span className="text-white font-medium">{slo.target}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Current</span>
                      <span className="text-white font-medium">{slo.current}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Budget Remaining</span>
                      <span className="text-white font-medium">{slo.errorBudgetRemaining}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Burn Rate</span>
                      <span className="text-white font-medium">{slo.burnRate}x</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block">Window</span>
                      <span className="text-white font-medium">{slo.timeWindow}</span>
                    </div>
                  </div>
                </div>
              </div>

              {expandedId === slo.id && (
                <div className="border-t border-gray-700 p-6 bg-gray-900/50">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                      <div className="bg-gray-800 rounded p-3">
                        <span className="text-gray-400 block">Target</span>
                        <span className="text-white font-medium">{slo.target}%</span>
                      </div>
                      <div className="bg-gray-800 rounded p-3">
                        <span className="text-gray-400 block">Current Compliance</span>
                        <span className="text-white font-medium">{slo.current}%</span>
                      </div>
                      <div className="bg-gray-800 rounded p-3">
                        <span className="text-gray-400 block">Error Budget Remaining</span>
                        <span className="text-white font-medium">{slo.errorBudgetRemaining}%</span>
                      </div>
                      <div className="bg-gray-800 rounded p-3">
                        <span className="text-gray-400 block">Burn Rate</span>
                        <span className="text-white font-medium">{slo.burnRate}x</span>
                      </div>
                    </div>
                    {slo.description && (
                      <p className="text-sm text-gray-400">{slo.description}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Create SLO</h3>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Name</label>
                <input
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="API Availability"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Service</label>
                <select
                  value={createForm.service_name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, service_name: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  {SERVICES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Metric Type</label>
                <select
                  value={createForm.sli_type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, sli_type: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="availability">Availability</option>
                  <option value="latency">Latency</option>
                  <option value="correctness">Correctness</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Target (%)</label>
                <input
                  type="number"
                  required
                  min={0}
                  max={100}
                  step={0.1}
                  value={createForm.target_percentage}
                  onChange={(e) => setCreateForm((f) => ({ ...f, target_percentage: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="99.9"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Time Window</label>
                <select
                  value={createForm.time_window_days}
                  onChange={(e) => setCreateForm((f) => ({ ...f, time_window_days: parseInt(e.target.value, 10) }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value={7}>7d</option>
                  <option value={30}>30d</option>
                  <option value={90}>90d</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
                <input
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                  placeholder="Description"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-400">{createError}</p>
              )}
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createSubmitting}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {createSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
