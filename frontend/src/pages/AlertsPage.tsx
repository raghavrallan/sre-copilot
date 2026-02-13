import { useState, useEffect } from 'react'
import { Bell, Plus, Mail, MessageSquare, Webhook, CheckCircle } from 'lucide-react'
import api from '../services/api'
import { useAuthStore } from '../lib/stores/auth-store'

type Tab = 'active' | 'conditions' | 'policies' | 'channels' | 'muting'

interface ActiveAlert {
  alert_id: string
  condition_id: string
  condition_name?: string
  service_name?: string
  fired_at: string
  severity: string
  message?: string
  status?: string
  acknowledged?: boolean
}

interface Condition {
  condition_id: string
  name: string
  metric_name: string
  operator: string
  threshold: number
  duration_seconds: number
  severity: string
  service_name: string
  enabled: boolean
  created_at?: string
}

interface Policy {
  policy_id: string
  name: string
  description?: string
  condition_ids?: string[]
  incident_preference: string
  enabled?: boolean
}

interface Channel {
  channel_id: string
  name: string
  type: string
  config?: Record<string, unknown>
  enabled: boolean
  created_at?: string
}

interface MutingRule {
  rule_id: string
  name: string
  start_time?: string
  end_time?: string
  repeat?: string
  condition_ids?: string[]
  enabled?: boolean
}

export default function AlertsPage() {
  const { currentProject } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('active')

  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [mutingRules, setMutingRules] = useState<MutingRule[]>([])

  const [loading, setLoading] = useState<Record<Tab, boolean>>({
    active: false,
    conditions: false,
    policies: false,
    channels: false,
    muting: false,
  })
  const [error, setError] = useState<Record<Tab, string | null>>({
    active: null,
    conditions: null,
    policies: null,
    channels: null,
    muting: null,
  })

  useEffect(() => {
    if (activeTab !== 'active' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, active: true }))
    setError((e) => ({ ...e, active: null }))
    api.get<ActiveAlert[]>('/api/v1/alerts/active-alerts', { params: { project_id: currentProject.id } })
      .then((res) => {
        if (!cancelled) setActiveAlerts(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError((e) => ({ ...e, active: err.response?.data?.detail ?? err.message ?? 'Failed to load active alerts' }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, active: false }))
      })
    return () => { cancelled = true }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'conditions' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, conditions: true }))
    setError((e) => ({ ...e, conditions: null }))
    api.get<Condition[]>('/api/v1/alerts/conditions', { params: { project_id: currentProject.id } })
      .then((res) => {
        if (!cancelled) setConditions(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError((e) => ({ ...e, conditions: err.response?.data?.detail ?? err.message ?? 'Failed to load conditions' }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, conditions: false }))
      })
    return () => { cancelled = true }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'policies' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, policies: true }))
    setError((e) => ({ ...e, policies: null }))
    api.get<Policy[]>('/api/v1/alerts/policies', { params: { project_id: currentProject.id } })
      .then((res) => {
        if (!cancelled) setPolicies(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError((e) => ({ ...e, policies: err.response?.data?.detail ?? err.message ?? 'Failed to load policies' }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, policies: false }))
      })
    return () => { cancelled = true }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'channels' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, channels: true }))
    setError((e) => ({ ...e, channels: null }))
    api.get<Channel[]>('/api/v1/alerts/channels', { params: { project_id: currentProject.id } })
      .then((res) => {
        if (!cancelled) setChannels(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError((e) => ({ ...e, channels: err.response?.data?.detail ?? err.message ?? 'Failed to load channels' }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, channels: false }))
      })
    return () => { cancelled = true }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'muting' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, muting: true }))
    setError((e) => ({ ...e, muting: null }))
    api.get<MutingRule[]>('/api/v1/alerts/muting-rules', { params: { project_id: currentProject.id } })
      .then((res) => {
        if (!cancelled) setMutingRules(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError((e) => ({ ...e, muting: err.response?.data?.detail ?? err.message ?? 'Failed to load muting rules' }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, muting: false }))
      })
    return () => { cancelled = true }
  }, [activeTab, currentProject?.id])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'active', label: 'Active Alerts' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'policies', label: 'Policies' },
    { id: 'channels', label: 'Channels' },
    { id: 'muting', label: 'Muting Rules' },
  ]

  const getSeverityColor = (s: string) => {
    if (s === 'critical') return 'bg-red-500/20 text-red-400'
    if (s === 'high') return 'bg-orange-500/20 text-orange-400'
    return 'bg-yellow-500/20 text-yellow-400'
  }

  const formatDuration = (firedAt: string) => {
    const start = new Date(firedAt).getTime()
    const now = Date.now()
    const diff = Math.floor((now - start) / 60000)
    if (diff < 60) return `${diff}m`
    const h = Math.floor(diff / 60)
    const m = diff % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }

  const formatThreshold = (op: string, th: number) => {
    if (op === 'gt') return `> ${th}`
    if (op === 'gte') return `>= ${th}`
    if (op === 'lt') return `< ${th}`
    if (op === 'lte') return `<= ${th}`
    return `${th}`
  }

  const formatIncidentPref = (p: string) => {
    if (p === 'per_condition') return 'Create incident per condition'
    if (p === 'per_policy') return 'Create incident per policy'
    return p
  }

  const formatSchedule = (r: MutingRule) => {
    if (r.start_time && r.end_time) {
      const s = new Date(r.start_time)
      const e = new Date(r.end_time)
      const repeat = r.repeat ? ` (${r.repeat})` : ''
      return `${s.toLocaleTimeString()} - ${e.toLocaleTimeString()}${repeat}`
    }
    return '—'
  }

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'email': return Mail
      case 'slack': return MessageSquare
      case 'webhook': return Webhook
      default: return Bell
    }
  }

  if (!currentProject?.id) {
    return (
      <div className="px-4 sm:px-0">
        <div className="py-12 text-center text-gray-400">
          Select a project to view alerts and notification settings.
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Bell className="w-8 h-8 text-blue-400" />
          Alerts & Notifications
        </h1>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
          <Plus className="w-4 h-4" />
          Create
        </button>
      </div>

      <div className="border-b border-gray-700 mb-6">
        <div className="flex gap-4">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === t.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'active' && (
        <>
          {error.active && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {error.active}
            </div>
          )}
          {loading.active ? (
            <div className="py-12 text-center text-gray-400">Loading active alerts...</div>
          ) : activeAlerts.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              No active alerts. Active alerts are derived from triggered conditions.
            </div>
          ) : (
            <div className="space-y-4">
              {activeAlerts.map((a) => (
                <div
                  key={a.alert_id}
                  className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getSeverityColor(a.severity)}`}>
                      {a.severity}
                    </span>
                    <div>
                      <p className="font-medium text-white">{a.condition_name ?? a.message ?? 'Alert'}</p>
                      <p className="text-sm text-gray-400">
                        {a.service_name ?? '-'} • Started {new Date(a.fired_at).toLocaleString()} • {formatDuration(a.fired_at)}
                      </p>
                    </div>
                  </div>
                  <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                    <CheckCircle className="w-4 h-4" />
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'conditions' && (
        <>
          {error.conditions && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {error.conditions}
            </div>
          )}
          {loading.conditions ? (
            <div className="py-12 text-center text-gray-400">Loading conditions...</div>
          ) : (
            <div className="space-y-4">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm mb-4">
                <Plus className="w-4 h-4" />
                Create Condition
              </button>
              <div className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-700">
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Metric</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Threshold</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Severity</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Service</th>
                      <th className="px-4 py-3 text-left text-sm text-gray-400 font-medium">Enabled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conditions.map((c) => (
                      <tr key={c.condition_id} className="border-b border-gray-700/50">
                        <td className="px-4 py-3 text-white">{c.name}</td>
                        <td className="px-4 py-3 text-gray-300">{c.metric_name}</td>
                        <td className="px-4 py-3 text-gray-300">{formatThreshold(c.operator, c.threshold)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded text-xs ${getSeverityColor(c.severity)}`}>{c.severity}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-300">{c.service_name}</td>
                        <td className="px-4 py-3">
                          <span className={`w-10 h-5 rounded-full block ${c.enabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {conditions.length === 0 && (
                  <div className="px-4 py-8 text-center text-gray-500">No conditions</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'policies' && (
        <>
          {error.policies && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {error.policies}
            </div>
          )}
          {loading.policies ? (
            <div className="py-12 text-center text-gray-400">Loading policies...</div>
          ) : (
            <div className="space-y-4">
              <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm mb-4">
                <Plus className="w-4 h-4" />
                Create Policy
              </button>
              <div className="space-y-3">
                {policies.map((p) => (
                  <div
                    key={p.policy_id}
                    className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">{p.name}</p>
                      <p className="text-sm text-gray-400">
                        {(p.condition_ids ?? []).length} conditions • {formatIncidentPref(p.incident_preference)}
                      </p>
                    </div>
                  </div>
                ))}
                {policies.length === 0 && (
                  <div className="py-8 text-center text-gray-500">No policies</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'channels' && (
        <>
          {error.channels && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {error.channels}
            </div>
          )}
          {loading.channels ? (
            <div className="py-12 text-center text-gray-400">Loading channels...</div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-2 mb-4">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
                  <Plus className="w-4 h-4" />
                  Create
                </button>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm">
                  Test
                </button>
              </div>
              <div className="space-y-3">
                {channels.map((c) => {
                  const Icon = getChannelIcon(c.type)
                  return (
                    <div
                      key={c.channel_id}
                      className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-gray-700/50">
                          <Icon className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-white">{c.name}</p>
                          <p className="text-sm text-gray-400 capitalize">{c.type} • {c.enabled ? 'Active' : 'Inactive'}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {channels.length === 0 && (
                  <div className="py-8 text-center text-gray-500">No channels</div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'muting' && (
        <>
          {error.muting && (
            <div className="mb-4 px-4 py-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300">
              {error.muting}
            </div>
          )}
          {loading.muting ? (
            <div className="py-12 text-center text-gray-400">Loading muting rules...</div>
          ) : (
            <div className="space-y-3">
              {mutingRules.map((m) => (
                <div
                  key={m.rule_id}
                  className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 flex items-center justify-between"
                >
                  <div>
                    <p className="font-medium text-white">{m.name}</p>
                    <p className="text-sm text-gray-400">
                      {formatSchedule(m)} • {(m.condition_ids ?? []).length} conditions matched
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs ${m.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-600 text-gray-400'}`}>
                    {m.enabled ? 'Active' : 'Inactive'}
                  </span>
                </div>
              ))}
              {mutingRules.length === 0 && (
                <div className="py-8 text-center text-gray-500">No muting rules</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
