import { useState, useEffect } from 'react'
import {
  Cloud,
  Loader2,
  Plug,
  RefreshCw,
  Pencil,
  Unplug,
  X,
  Check,
  AlertCircle,
} from 'lucide-react'
import { useAuthStore } from '../../lib/stores/auth-store'
import api from '../../services/api'
import toast from 'react-hot-toast'

type Provider = 'azure' | 'aws' | 'gcp'

interface CloudConnection {
  id: string
  project_id: string
  provider: Provider
  name: string
  config: Record<string, unknown>
  is_active: boolean
  status: 'pending' | 'connected' | 'error' | 'syncing'
  status_message: string
  last_sync_at: string | null
  resources_count: number
  created_at: string
  updated_at: string
}

interface ConnectionsResponse {
  connections: CloudConnection[]
}

const PROVIDER_CONFIG: Record<
  Provider,
  { name: string; colors: string; icon: React.ReactNode }
> = {
  azure: {
    name: 'Azure',
    colors: 'border-blue-500/50 bg-blue-500/5',
    icon: <Cloud className="w-8 h-8 text-blue-400" />,
  },
  aws: {
    name: 'AWS',
    colors: 'border-orange-500/50 bg-orange-500/5',
    icon: <Cloud className="w-8 h-8 text-orange-400" />,
  },
  gcp: {
    name: 'GCP',
    colors: 'border-green-500/30 border-red-500/30 border-yellow-500/30 border-blue-500/30 bg-gradient-to-br from-green-500/5 via-blue-500/5 to-yellow-500/5',
    icon: <Cloud className="w-8 h-8 text-green-400" />,
  },
}

const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-west-1',
  'eu-west-2',
  'eu-central-1',
  'eu-north-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'sa-east-1',
]

function formatDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

export default function CloudProviderSettings() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [connections, setConnections] = useState<CloudConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalProvider, setModalProvider] = useState<Provider | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState('')

  // Form state per provider
  const [azureForm, setAzureForm] = useState({
    tenant_id: '',
    client_id: '',
    client_secret: '',
    subscription_id: '',
  })
  const [awsForm, setAwsForm] = useState({
    access_key_id: '',
    secret_access_key: '',
    region: 'us-east-1',
    assume_role_arn: '',
  })
  const [gcpForm, setGcpForm] = useState({
    service_account_json: '',
    project_id: '',
  })

  const fetchConnections = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data } = await api.get<ConnectionsResponse>('/api/v1/connections', {
        params: { project_id: projectId },
      })
      setConnections(data?.connections ?? [])
    } catch {
      setConnections([])
      toast.error('Failed to load cloud connections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [projectId])

  const openConnectModal = (provider: Provider, conn?: CloudConnection) => {
    setModalProvider(provider)
    setEditingId(conn?.id ?? null)
    setConnectionName(conn?.name ?? `${PROVIDER_CONFIG[provider].name} Connection`)
    setTestResult(null)
    setModalOpen(true)
    if (conn) {
      // Editing - we don't have credentials, so leave form empty
      setAzureForm({ tenant_id: '', client_id: '', client_secret: '', subscription_id: '' })
      setAwsForm({ access_key_id: '', secret_access_key: '', region: 'us-east-1', assume_role_arn: '' })
      setGcpForm({ service_account_json: '', project_id: conn.config?.project_id as string ?? '' })
    } else {
      setAzureForm({ tenant_id: '', client_id: '', client_secret: '', subscription_id: '' })
      setAwsForm({ access_key_id: '', secret_access_key: '', region: 'us-east-1', assume_role_arn: '' })
      setGcpForm({ service_account_json: '', project_id: '' })
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalProvider(null)
    setEditingId(null)
    setTestResult(null)
  }

  const getCredentialsAndConfig = (): { credentials: Record<string, unknown>; config: Record<string, unknown> } => {
    if (modalProvider === 'azure') {
      return {
        credentials: {
          tenant_id: azureForm.tenant_id,
          client_id: azureForm.client_id,
          client_secret: azureForm.client_secret,
          subscription_id: azureForm.subscription_id,
        },
        config: {},
      }
    }
    if (modalProvider === 'aws') {
      return {
        credentials: {
          access_key_id: awsForm.access_key_id,
          secret_access_key: awsForm.secret_access_key,
          region: awsForm.region,
        },
        config: awsForm.assume_role_arn ? { assume_role_arn: awsForm.assume_role_arn } : {},
      }
    }
    if (modalProvider === 'gcp') {
      let creds: Record<string, unknown> = {}
      try {
        if (gcpForm.service_account_json.trim()) {
          creds = JSON.parse(gcpForm.service_account_json) as Record<string, unknown>
        }
      } catch {
        creds = {}
      }
      return {
        credentials: creds,
        config: gcpForm.project_id ? { project_id: gcpForm.project_id } : {},
      }
    }
    return { credentials: {}, config: {} }
  }

  const handleTest = async () => {
    if (!modalProvider || !projectId) return
    const { credentials, config } = getCredentialsAndConfig()
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post<{ success: boolean; message: string }>(
        '/api/v1/connections/test',
        { provider: modalProvider, credentials, config },
        { params: { project_id: projectId } }
      )
      setTestResult({
        success: data?.success ?? false,
        message: data?.message ?? (data?.success ? 'Connection successful' : 'Connection failed'),
      })
      if (data?.success) {
        toast.success('Connection test successful')
      } else {
        toast.error(data?.message ?? 'Connection test failed')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection test failed'
      setTestResult({ success: false, message: msg })
      toast.error(msg)
    } finally {
      setTesting(false)
    }
  }

  const hasValidCredentials = (): boolean => {
    if (modalProvider === 'azure') {
      return !!(azureForm.tenant_id && azureForm.client_id && azureForm.client_secret && azureForm.subscription_id)
    }
    if (modalProvider === 'aws') {
      return !!(awsForm.access_key_id && awsForm.secret_access_key)
    }
    if (modalProvider === 'gcp') {
      try {
        const p = JSON.parse(gcpForm.service_account_json)
        return typeof p === 'object' && p !== null && Object.keys(p).length > 0
      } catch {
        return false
      }
    }
    return false
  }

  const handleSave = async () => {
    if (!modalProvider || !projectId) return
    const { credentials, config } = getCredentialsAndConfig()
    const hasCredentials = hasValidCredentials()
    setSaving(true)
    try {
      if (editingId) {
        const payload: Record<string, unknown> = { name: connectionName }
        if (hasCredentials) payload.credentials = credentials
        if (Object.keys(config).length) payload.config = config
        await api.patch(`/api/v1/connections/${editingId}`, payload, {
          params: { project_id: projectId },
        })
        toast.success('Connection updated')
      } else {
        await api.post('/api/v1/connections', {
          provider: modalProvider,
          name: connectionName,
          credentials,
          config,
        }, { params: { project_id: projectId } })
        toast.success('Connection created')
      }
      closeModal()
      fetchConnections()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save connection'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDisconnect = async (conn: CloudConnection) => {
    if (!projectId || !confirm(`Disconnect ${conn.name}? This will remove the connection.`)) return
    setDisconnecting(conn.id)
    try {
      await api.delete(`/api/v1/connections/${conn.id}`, {
        params: { project_id: projectId },
      })
      toast.success('Connection removed')
      fetchConnections()
    } catch {
      toast.error('Failed to remove connection')
    } finally {
      setDisconnecting(null)
    }
  }

  const canSave = () => {
    if (!connectionName.trim()) return false
    if (editingId) {
      return true
    }
    if (modalProvider === 'azure') {
      return !!(
        azureForm.tenant_id &&
        azureForm.client_id &&
        azureForm.client_secret &&
        azureForm.subscription_id
      )
    }
    if (modalProvider === 'aws') {
      return !!(awsForm.access_key_id && awsForm.secret_access_key)
    }
    if (modalProvider === 'gcp') {
      try {
        const parsed = JSON.parse(gcpForm.service_account_json)
        return typeof parsed === 'object' && parsed !== null
      } catch {
        return false
      }
    }
    return false
  }

  const getConnectionForProvider = (p: Provider) =>
    connections.find((c) => c.provider === p && c.is_active)

  if (!projectId) {
    return (
      <div className="text-gray-400 text-sm">Select a project to manage cloud connections.</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">Cloud Providers</h3>
            <p className="text-sm text-gray-400 mt-1">
              Connect Azure, AWS, or GCP to discover and monitor cloud resources.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['azure', 'aws', 'gcp'] as Provider[]).map((provider) => {
              const conn = getConnectionForProvider(provider)
              const cfg = PROVIDER_CONFIG[provider]
              const isConnected = !!conn
              return (
                <div
                  key={provider}
                  className={`rounded-lg border p-6 ${cfg.colors} transition-colors`}
                >
                  <div className="flex items-start gap-4">
                    <div className="text-gray-400 flex-shrink-0">{cfg.icon}</div>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-semibold text-white">{cfg.name}</h4>
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            isConnected
                              ? conn?.status === 'connected'
                                ? 'bg-green-500/20 text-green-400'
                                : conn?.status === 'syncing'
                                ? 'bg-blue-500/20 text-blue-400'
                                : conn?.status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-600/50 text-gray-400'
                          }`}
                        >
                          {isConnected
                            ? conn?.status === 'connected'
                              ? 'Connected'
                              : conn?.status === 'syncing'
                              ? 'Syncing'
                              : conn?.status === 'error'
                              ? 'Error'
                              : 'Pending'
                            : 'Disconnected'}
                        </span>
                      </div>
                      {isConnected && conn && (
                        <>
                          <p className="text-xs text-gray-500 mt-1">
                            Last sync: {formatDate(conn.last_sync_at)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {conn.resources_count} resources
                          </p>
                          {conn.status_message && (
                            <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" />
                              {conn.status_message}
                            </p>
                          )}
                        </>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isConnected && conn ? (
                          <>
                            <button
                              onClick={() => fetchConnections()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Sync Now
                            </button>
                            <button
                              onClick={() => openConnectModal(provider, conn)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDisconnect(conn)}
                              disabled={disconnecting === conn.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {disconnecting === conn.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unplug className="w-3.5 h-3.5" />
                              )}
                              Disconnect
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => openConnectModal(provider)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                          >
                            <Plug className="w-3.5 h-3.5" />
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Connect/Edit Modal */}
      {modalOpen && modalProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-gray-800 rounded-lg border border-gray-700 shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white">
                  {editingId ? 'Edit' : 'Connect'} {PROVIDER_CONFIG[modalProvider].name}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <label className="block text-sm font-medium text-gray-300 mb-2">
                Connection name
              </label>
              <input
                type="text"
                value={connectionName}
                onChange={(e) => setConnectionName(e.target.value)}
                placeholder="e.g. Production Account"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              />

              {modalProvider === 'azure' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tenant ID *
                    </label>
                    <input
                      type="text"
                      value={azureForm.tenant_id}
                      onChange={(e) => setAzureForm((f) => ({ ...f, tenant_id: e.target.value }))}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Client ID *
                    </label>
                    <input
                      type="text"
                      value={azureForm.client_id}
                      onChange={(e) => setAzureForm((f) => ({ ...f, client_id: e.target.value }))}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Client Secret *
                    </label>
                    <input
                      type="password"
                      value={azureForm.client_secret}
                      onChange={(e) => setAzureForm((f) => ({ ...f, client_secret: e.target.value }))}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Subscription ID *
                    </label>
                    <input
                      type="text"
                      value={azureForm.subscription_id}
                      onChange={(e) => setAzureForm((f) => ({ ...f, subscription_id: e.target.value }))}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalProvider === 'aws' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Access Key ID *
                    </label>
                    <input
                      type="text"
                      value={awsForm.access_key_id}
                      onChange={(e) => setAwsForm((f) => ({ ...f, access_key_id: e.target.value }))}
                      placeholder="AKIA..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Secret Access Key *
                    </label>
                    <input
                      type="password"
                      value={awsForm.secret_access_key}
                      onChange={(e) => setAwsForm((f) => ({ ...f, secret_access_key: e.target.value }))}
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Region
                    </label>
                    <select
                      value={awsForm.region}
                      onChange={(e) => setAwsForm((f) => ({ ...f, region: e.target.value }))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500"
                    >
                      {AWS_REGIONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Assume Role ARN (optional)
                    </label>
                    <input
                      type="text"
                      value={awsForm.assume_role_arn}
                      onChange={(e) => setAwsForm((f) => ({ ...f, assume_role_arn: e.target.value }))}
                      placeholder="arn:aws:iam::123456789012:role/MyRole"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalProvider === 'gcp' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Service Account JSON *
                    </label>
                    <textarea
                      value={gcpForm.service_account_json}
                      onChange={(e) => setGcpForm((f) => ({ ...f, service_account_json: e.target.value }))}
                      placeholder='{"type":"service_account","project_id":"...",...}'
                      rows={6}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Project ID
                    </label>
                    <input
                      type="text"
                      value={gcpForm.project_id}
                      onChange={(e) => setGcpForm((f) => ({ ...f, project_id: e.target.value }))}
                      placeholder="my-gcp-project"
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

              <div className="mt-6 flex items-center justify-end gap-2">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing || !hasValidCredentials()}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg disabled:opacity-50"
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                  Test Connection
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
      )}
    </div>
  )
}
