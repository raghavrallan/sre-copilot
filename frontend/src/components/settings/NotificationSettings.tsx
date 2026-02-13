import { useState, useEffect } from 'react'
import {
  Mail,
  MessageSquare,
  Bell,
  Phone,
  Webhook,
  Loader2,
  Settings,
  X,
  Check,
  AlertCircle,
  Trash2,
} from 'lucide-react'
import { useAuthStore } from '../../lib/stores/auth-store'
import api from '../../services/api'
import toast from 'react-hot-toast'

type ChannelType = 'notification_email' | 'notification_slack' | 'notification_pagerduty' | 'notification_teams' | 'notification_webhook'

interface NotificationConnection {
  id: string
  project_id?: string
  category: string
  name: string
  config: Record<string, unknown>
  is_active: boolean
  created_at?: string
  updated_at?: string
}

const CHANNEL_CONFIG: Record<
  ChannelType,
  { name: string; colors: string; icon: React.ReactNode }
> = {
  notification_email: {
    name: 'Email SMTP',
    colors: 'border-gray-500/50 bg-gray-500/5',
    icon: <Mail className="w-8 h-8 text-gray-300" />,
  },
  notification_slack: {
    name: 'Slack',
    colors: 'border-purple-500/50 bg-purple-500/5',
    icon: <MessageSquare className="w-8 h-8 text-purple-400" />,
  },
  notification_pagerduty: {
    name: 'PagerDuty',
    colors: 'border-red-500/50 bg-red-500/5',
    icon: <Phone className="w-8 h-8 text-red-400" />,
  },
  notification_teams: {
    name: 'Microsoft Teams',
    colors: 'border-blue-500/50 bg-blue-500/5',
    icon: <Bell className="w-8 h-8 text-blue-400" />,
  },
  notification_webhook: {
    name: 'Webhook',
    colors: 'border-cyan-500/50 bg-cyan-500/5',
    icon: <Webhook className="w-8 h-8 text-cyan-400" />,
  },
}

export default function NotificationSettings() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [connections, setConnections] = useState<NotificationConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalChannel, setModalChannel] = useState<ChannelType | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const [emailForm, setEmailForm] = useState({
    smtp_host: '',
    smtp_port: '587',
    username: '',
    password: '',
    from_address: '',
    use_tls: true,
  })
  const [slackForm, setSlackForm] = useState({
    webhook_url: '',
    channel: '',
  })
  const [pagerdutyForm, setPagerdutyForm] = useState({
    integration_key: '',
    service_id: '',
  })
  const [teamsForm, setTeamsForm] = useState({
    webhook_url: '',
  })
  const [webhookForm, setWebhookForm] = useState({
    url: '',
    method: 'POST' as 'POST' | 'PUT',
    headers: '{}',
    secret: '',
  })

  const fetchConnections = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data } = await api.get<{ connections?: NotificationConnection[] }>(
        '/api/v1/settings/connections',
        { params: { project_id: projectId, category_prefix: 'notification_' } }
      )
      const list = data?.connections ?? []
      setConnections(Array.isArray(list) ? list : [])
    } catch {
      setConnections([])
      toast.error('Failed to load notification channels')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [projectId])

  const openConfigureModal = (channel: ChannelType, conn?: NotificationConnection) => {
    setModalChannel(channel)
    setEditingId(conn?.id ?? null)
    setTestResult(null)
    setModalOpen(true)
    if (conn?.config) {
      const cfg = conn.config as Record<string, string | boolean | number>
      if (channel === 'notification_email') {
        setEmailForm({
          smtp_host: (cfg.smtp_host as string) ?? '',
          smtp_port: String(cfg.smtp_port ?? 587),
          username: (cfg.username as string) ?? '',
          password: '',
          from_address: (cfg.from_address as string) ?? '',
          use_tls: cfg.use_tls !== false,
        })
      } else if (channel === 'notification_slack') {
        setSlackForm({
          webhook_url: (cfg.webhook_url as string) ?? '',
          channel: (cfg.channel as string) ?? '',
        })
      } else if (channel === 'notification_pagerduty') {
        setPagerdutyForm({
          integration_key: (cfg.integration_key as string) ?? '',
          service_id: (cfg.service_id as string) ?? '',
        })
      } else if (channel === 'notification_teams') {
        setTeamsForm({
          webhook_url: (cfg.webhook_url as string) ?? '',
        })
      } else if (channel === 'notification_webhook') {
        const headers = cfg.headers
        setWebhookForm({
          url: (cfg.url as string) ?? '',
          method: (cfg.method as 'POST' | 'PUT') || 'POST',
          headers: typeof headers === 'string' ? headers : JSON.stringify(headers ?? {}, null, 2),
          secret: '',
        })
      }
    } else {
      setEmailForm({
        smtp_host: '',
        smtp_port: '587',
        username: '',
        password: '',
        from_address: '',
        use_tls: true,
      })
      setSlackForm({ webhook_url: '', channel: '' })
      setPagerdutyForm({ integration_key: '', service_id: '' })
      setTeamsForm({ webhook_url: '' })
      setWebhookForm({ url: '', method: 'POST', headers: '{}', secret: '' })
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalChannel(null)
    setEditingId(null)
    setTestResult(null)
  }

  const getConfigPayload = (): Record<string, unknown> => {
    if (modalChannel === 'notification_email') {
      return {
        smtp_host: emailForm.smtp_host,
        smtp_port: parseInt(emailForm.smtp_port, 10) || 587,
        username: emailForm.username,
        password: emailForm.password || undefined,
        from_address: emailForm.from_address,
        use_tls: emailForm.use_tls,
      }
    }
    if (modalChannel === 'notification_slack') {
      return {
        webhook_url: slackForm.webhook_url,
        channel: slackForm.channel || undefined,
      }
    }
    if (modalChannel === 'notification_pagerduty') {
      return {
        integration_key: pagerdutyForm.integration_key,
        service_id: pagerdutyForm.service_id || undefined,
      }
    }
    if (modalChannel === 'notification_teams') {
      return { webhook_url: teamsForm.webhook_url }
    }
    if (modalChannel === 'notification_webhook') {
      let headers: Record<string, string> = {}
      try {
        headers = JSON.parse(webhookForm.headers || '{}') as Record<string, string>
      } catch {
        // ignore
      }
      return {
        url: webhookForm.url,
        method: webhookForm.method,
        headers,
        secret: webhookForm.secret || undefined,
      }
    }
    return {}
  }

  const hasValidConfig = (): boolean => {
    if (modalChannel === 'notification_email') {
      return !!(
        emailForm.smtp_host &&
        emailForm.username &&
        emailForm.from_address
      )
    }
    if (modalChannel === 'notification_slack') {
      return !!slackForm.webhook_url
    }
    if (modalChannel === 'notification_pagerduty') {
      return !!pagerdutyForm.integration_key
    }
    if (modalChannel === 'notification_teams') {
      return !!teamsForm.webhook_url
    }
    if (modalChannel === 'notification_webhook') {
      return !!webhookForm.url
    }
    return false
  }

  const handleTest = async () => {
    if (!modalChannel || !projectId) return
    const config = getConfigPayload()
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post<{ success: boolean; message: string }>(
        '/api/v1/settings/connections/test',
        { category: modalChannel, config },
        { params: { project_id: projectId } }
      )
      setTestResult({
        success: data?.success ?? false,
        message: data?.message ?? (data?.success ? 'Test notification sent' : 'Test failed'),
      })
      if (data?.success) {
        toast.success('Test notification sent')
      } else {
        toast.error(data?.message ?? 'Test failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Test failed'
      setTestResult({ success: false, message: msg })
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    if (!modalChannel || !projectId) return
    const config = getConfigPayload()
    setSaving(true)
    try {
      if (editingId) {
        await api.put(
          '/api/v1/settings/connections',
          {
            id: editingId,
            category: modalChannel,
            name: CHANNEL_CONFIG[modalChannel].name,
            config,
          },
          { params: { project_id: projectId } }
        )
        toast.success('Channel updated')
      } else {
        await api.put(
          '/api/v1/settings/connections',
          {
            category: modalChannel,
            name: CHANNEL_CONFIG[modalChannel].name,
            config,
          },
          { params: { project_id: projectId } }
        )
        toast.success('Channel configured')
      }
      closeModal()
      fetchConnections()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!editingId || !projectId || !confirm('Delete this notification channel?')) return
    setDeleting(editingId)
    try {
      await api.delete(`/api/v1/settings/connections/${editingId}`, {
        params: { project_id: projectId },
      })
      toast.success('Channel removed')
      closeModal()
      fetchConnections()
    } catch {
      toast.error('Failed to remove channel')
    } finally {
      setDeleting(null)
    }
  }

  const canSave = () => hasValidConfig()

  const getConnectionForChannel = (channel: ChannelType) =>
    connections.find((c) => c.category === channel && c.is_active)

  if (!projectId) {
    return (
      <div className="text-gray-400 text-sm">Select a project to manage notification channels.</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">Notification Channels</h3>
            <p className="text-sm text-gray-400 mt-1">
              Configure Email, Slack, PagerDuty, Teams, or Webhooks for alert delivery.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(
              [
                'notification_email',
                'notification_slack',
                'notification_pagerduty',
                'notification_teams',
                'notification_webhook',
              ] as ChannelType[]
            ).map((channel) => {
              const conn = getConnectionForChannel(channel)
              const cfg = CHANNEL_CONFIG[channel]
              const isConfigured = !!conn

              return (
                <div
                  key={channel}
                  className={`rounded-lg border p-6 ${cfg.colors} transition-colors`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-gray-400 flex-shrink-0">{cfg.icon}</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white">{cfg.name}</h4>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            isConfigured
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-600/50 text-gray-400'
                          }`}
                        >
                          {isConfigured ? 'Connected' : 'Not configured'}
                        </span>
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={() => openConfigureModal(channel, conn ?? undefined)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          {isConfigured ? 'Edit' : 'Configure'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Configure Modal */}
      {modalOpen && modalChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  Configure {CHANNEL_CONFIG[modalChannel].name}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {modalChannel === 'notification_email' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SMTP Host *
                    </label>
                    <input
                      type="text"
                      value={emailForm.smtp_host}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, smtp_host: e.target.value }))
                      }
                      placeholder="smtp.example.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Port *
                    </label>
                    <input
                      type="text"
                      value={emailForm.smtp_port}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, smtp_port: e.target.value }))
                      }
                      placeholder="587"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={emailForm.username}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Password
                    </label>
                    <input
                      type="password"
                      value={emailForm.password}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, password: e.target.value }))
                      }
                      placeholder={editingId ? 'Leave blank to keep' : '••••••••'}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      From Address *
                    </label>
                    <input
                      type="text"
                      value={emailForm.from_address}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, from_address: e.target.value }))
                      }
                      placeholder="alerts@example.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="use_tls"
                      checked={emailForm.use_tls}
                      onChange={(e) =>
                        setEmailForm((f) => ({ ...f, use_tls: e.target.checked }))
                      }
                      className="rounded border-gray-600 bg-gray-900 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="use_tls" className="text-sm text-gray-300">
                      Use TLS
                    </label>
                  </div>
                </div>
              )}

              {modalChannel === 'notification_slack' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Webhook URL *
                    </label>
                    <input
                      type="url"
                      value={slackForm.webhook_url}
                      onChange={(e) =>
                        setSlackForm((f) => ({ ...f, webhook_url: e.target.value }))
                      }
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Channel
                    </label>
                    <input
                      type="text"
                      value={slackForm.channel}
                      onChange={(e) =>
                        setSlackForm((f) => ({ ...f, channel: e.target.value }))
                      }
                      placeholder="#alerts"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalChannel === 'notification_pagerduty' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Integration Key *
                    </label>
                    <input
                      type="password"
                      value={pagerdutyForm.integration_key}
                      onChange={(e) =>
                        setPagerdutyForm((f) => ({ ...f, integration_key: e.target.value }))
                      }
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Service ID
                    </label>
                    <input
                      type="text"
                      value={pagerdutyForm.service_id}
                      onChange={(e) =>
                        setPagerdutyForm((f) => ({ ...f, service_id: e.target.value }))
                      }
                      placeholder="PXXXXXX"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalChannel === 'notification_teams' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Webhook URL *
                    </label>
                    <input
                      type="url"
                      value={teamsForm.webhook_url}
                      onChange={(e) =>
                        setTeamsForm((f) => ({ ...f, webhook_url: e.target.value }))
                      }
                      placeholder="https://outlook.office.com/webhook/..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalChannel === 'notification_webhook' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      URL *
                    </label>
                    <input
                      type="url"
                      value={webhookForm.url}
                      onChange={(e) =>
                        setWebhookForm((f) => ({ ...f, url: e.target.value }))
                      }
                      placeholder="https://api.example.com/webhook"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Method
                    </label>
                    <select
                      value={webhookForm.method}
                      onChange={(e) =>
                        setWebhookForm((f) => ({
                          ...f,
                          method: e.target.value as 'POST' | 'PUT',
                        }))
                      }
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="POST">POST</option>
                      <option value="PUT">PUT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Headers (JSON)
                    </label>
                    <textarea
                      value={webhookForm.headers}
                      onChange={(e) =>
                        setWebhookForm((f) => ({ ...f, headers: e.target.value }))
                      }
                      placeholder='{"Authorization": "Bearer token"}'
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Secret
                    </label>
                    <input
                      type="password"
                      value={webhookForm.secret}
                      onChange={(e) =>
                        setWebhookForm((f) => ({ ...f, secret: e.target.value }))
                      }
                      placeholder="Optional signing secret"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {testResult && (
                <div
                  className={`mt-4 flex items-center gap-2 p-3 rounded-lg ${
                    testResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                  }`}
                >
                  {testResult.success ? (
                    <Check className="w-5 h-5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  )}
                  <span className="text-sm">{testResult.message}</span>
                </div>
              )}

              <div className="mt-6 flex items-center justify-between">
                <div>
                  {editingId && (
                    <button
                      onClick={handleDelete}
                      disabled={deleting === editingId}
                      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/10 rounded-lg disabled:opacity-50"
                    >
                      {deleting === editingId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Delete
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTest}
                    disabled={testing || !hasValidConfig()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50"
                  >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
                    Test
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !canSave()}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
