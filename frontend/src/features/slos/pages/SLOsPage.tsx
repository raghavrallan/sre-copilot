import { useState, useEffect } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
import { Target, Plus, Loader2, AlertCircle, BarChart3, TrendingUp } from 'lucide-react'
import api from '../../../services/api'

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
    promql_expr: '',
  })
  const [liveCompliance, setLiveCompliance] = useState<Record<string, any>>({})
  const [grafanaDashboards, setGrafanaDashboards] = useState<any[]>([])
  const [showPanelPicker, setShowPanelPicker] = useState(false)
  const [selectedDashUid, setSelectedDashUid] = useState('')
  const [dashPanels, setDashPanels] = useState<any[]>([])

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

  // Fetch live compliance for SLOs that have promql_expr in description
  useEffect(() => {
    if (slos.length === 0) return
    slos.forEach(async (slo) => {
      const promqlMatch = slo.description?.match(/\[promql:(.+?)\]/)
      if (!promqlMatch) return
      try {
        const resp = await api.post('/api/v1/grafana/slo-query', {
          expr: promqlMatch[1],
          target_percentage: slo.target,
          time_window_days: parseInt(slo.timeWindow) || 30,
        })
        setLiveCompliance(prev => ({ ...prev, [slo.id]: resp.data }))
      } catch { /* ignore */ }
    })
  }, [slos])

  // Load Grafana dashboards for panel picker
  useEffect(() => {
    api.get('/api/v1/grafana/dashboards')
      .then(resp => setGrafanaDashboards((resp.data.dashboards || []).filter((d: any) => d.uid)))
      .catch(() => {})
  }, [])

  const loadDashboardPanels = async (uid: string) => {
    setSelectedDashUid(uid)
    try {
      const resp = await api.get(`/api/v1/grafana/dashboards/${uid}`)
      const panels = resp.data.panels || []
      setDashPanels(panels.filter((p: any) => p.targets?.length > 0 && p.type !== 'row' && p.type !== 'text'))
    } catch { setDashPanels([]) }
  }

  const pickPanelExpr = (panel: any) => {
    const expr = panel.targets?.[0]?.expr || ''
    setCreateForm(f => ({ ...f, promql_expr: expr }))
    setShowPanelPicker(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const payload = { ...createForm }
      if (payload.promql_expr) {
        payload.description = `${payload.description || ''} [promql:${payload.promql_expr}]`.trim()
      }
      const { promql_expr: _, ...apiPayload } = payload
      const { data } = await api.post<SLOApi>('/api/v1/slos', apiPayload)
      setSlos((prev) => [mapApiToSLO(data), ...prev])
      setShowCreateModal(false)
      setCreateForm({
        name: '',
        service_name: SERVICES[0],
        sli_type: 'availability',
        target_percentage: 99.9,
        time_window_days: 30,
        description: '',
        promql_expr: '',
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
                    {liveCompliance[slo.id] ? (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                        <div className="bg-gray-800 rounded p-3">
                          <span className="text-gray-400 block">Target</span>
                          <span className="text-white font-medium">{liveCompliance[slo.id].target}%</span>
                        </div>
                        <div className="bg-gray-800 rounded p-3">
                          <span className="text-gray-400 block flex items-center gap-1">Live Compliance <TrendingUp className="w-3 h-3 text-green-400" /></span>
                          <span className={`font-medium ${liveCompliance[slo.id].compliance >= liveCompliance[slo.id].target ? 'text-green-400' : 'text-red-400'}`}>
                            {liveCompliance[slo.id].compliance?.toFixed(2)}%
                          </span>
                        </div>
                        <div className="bg-gray-800 rounded p-3">
                          <span className="text-gray-400 block">Error Budget</span>
                          <span className={`font-medium ${liveCompliance[slo.id].error_budget_remaining > 20 ? 'text-white' : 'text-red-400'}`}>
                            {liveCompliance[slo.id].error_budget_remaining?.toFixed(1)}%
                          </span>
                        </div>
                        <div className="bg-gray-800 rounded p-3">
                          <span className="text-gray-400 block">Burn Rate</span>
                          <span className={`font-medium ${liveCompliance[slo.id].burn_rate > 1 ? 'text-red-400' : 'text-white'}`}>
                            {liveCompliance[slo.id].burn_rate?.toFixed(2)}x
                          </span>
                        </div>
                      </div>
                    ) : (
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
                    )}
                    {liveCompliance[slo.id]?.series?.length > 0 && (
                      <div className="bg-gray-800 rounded p-3">
                        <p className="text-xs text-gray-400 mb-2">SLI Trend ({slo.timeWindow})</p>
                        <ResponsiveContainer width="100%" height={100}>
                          <AreaChart data={liveCompliance[slo.id].series[0]?.data || []}>
                            <XAxis dataKey="t" tickFormatter={(t: number) => new Date(t).toLocaleDateString()} tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                            <YAxis hide domain={['auto', 'auto']} />
                            <Tooltip labelFormatter={(t: number) => new Date(t).toLocaleString()} formatter={(v: number) => [v?.toFixed(4), 'SLI']} contentStyle={{ fontSize: 11 }} />
                            <defs><linearGradient id="sliGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient></defs>
                            <Area type="monotone" dataKey="v" stroke="#3B82F6" fill="url(#sliGrad)" strokeWidth={1.5} dot={false} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {slo.description && (
                      <p className="text-sm text-gray-400">{slo.description?.replace(/\[promql:.+?\]/, '').trim()}</p>
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
              <div>
                <label className="block text-sm text-gray-400 mb-1 flex items-center gap-1">
                  PromQL Expression <span className="text-xs text-gray-500">(optional, for live compliance)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    value={createForm.promql_expr}
                    onChange={(e) => setCreateForm((f) => ({ ...f, promql_expr: e.target.value }))}
                    className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 font-mono text-xs"
                    placeholder="e.g. rate(http_requests_total{status=~'2..'}[5m]) / rate(http_requests_total[5m])"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPanelPicker(!showPanelPicker)}
                    className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs flex items-center gap-1"
                  >
                    <BarChart3 className="w-3.5 h-3.5" /> Panel
                  </button>
                </div>
                {showPanelPicker && (
                  <div className="mt-2 border border-gray-600 rounded-lg p-3 bg-gray-750 space-y-2">
                    <select
                      value={selectedDashUid}
                      onChange={(e) => loadDashboardPanels(e.target.value)}
                      className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                    >
                      <option value="">Select dashboard...</option>
                      {grafanaDashboards.map(d => <option key={d.uid} value={d.uid}>{d.title}</option>)}
                    </select>
                    {dashPanels.length > 0 && (
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {dashPanels.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => pickPanelExpr(p)}
                            className="w-full text-left px-2 py-1.5 text-xs text-gray-300 hover:bg-gray-600 rounded"
                          >
                            {p.title} <span className="text-gray-500">({p.type})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
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
