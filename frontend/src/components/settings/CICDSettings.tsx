import { useState, useEffect } from 'react'
import {
  Github,
  Loader2,
  Plug,
  Pencil,
  Unplug,
  X,
  Check,
  AlertCircle,
  Copy,
  Workflow,
} from 'lucide-react'
import { useAuthStore } from '../../lib/stores/auth-store'
import api from '../../services/api'
import toast from 'react-hot-toast'

type Provider = 'github' | 'azure_devops' | 'gitlab' | 'jenkins'

interface CICDConnection {
  id: string
  project_id: string
  provider: Provider
  name: string
  config: Record<string, unknown>
  is_active: boolean
  status: 'pending' | 'connected' | 'error'
  status_message?: string
  repos_count?: number
  pipelines_count?: number
  webhook_url?: string
  created_at: string
  updated_at: string
}

const PROVIDER_CONFIG: Record<
  Provider,
  { name: string; colors: string; icon: React.ReactNode }
> = {
  github: {
    name: 'GitHub',
    colors: 'border-gray-500/50 bg-gray-500/5',
    icon: <Github className="w-8 h-8 text-gray-300" />,
  },
  azure_devops: {
    name: 'Azure DevOps',
    colors: 'border-blue-500/50 bg-blue-500/5',
    icon: <Workflow className="w-8 h-8 text-blue-400" />,
  },
  gitlab: {
    name: 'GitLab',
    colors: 'border-orange-500/50 bg-orange-500/5',
    icon: <Workflow className="w-8 h-8 text-orange-400" />,
  },
  jenkins: {
    name: 'Jenkins',
    colors: 'border-red-500/50 bg-red-500/5',
    icon: <Workflow className="w-8 h-8 text-red-400" />,
  },
}

export default function CICDSettings() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [connections, setConnections] = useState<CICDConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalProvider, setModalProvider] = useState<Provider | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState('')
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null)

  const [githubForm, setGithubForm] = useState({
    personal_access_token: '',
    organization: '',
  })
  const [azureForm, setAzureForm] = useState({
    organization_url: '',
    personal_access_token: '',
    project: '',
  })
  const [gitlabForm, setGitlabForm] = useState({
    gitlab_url: '',
    personal_access_token: '',
    project_id: '',
  })
  const [jenkinsForm, setJenkinsForm] = useState({
    jenkins_url: '',
    username: '',
    api_token: '',
  })

  const fetchConnections = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data } = await api.get<CICDConnection[]>(
        '/api/v1/cicd/connections',
        { params: { project_id: projectId } }
      )
      setConnections(Array.isArray(data) ? data : [])
    } catch {
      setConnections([])
      toast.error('Failed to load CI/CD connections')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchConnections()
  }, [projectId])

  const openConnectModal = (provider: Provider, conn?: CICDConnection) => {
    setModalProvider(provider)
    setEditingId(conn?.id ?? null)
    setConnectionName(conn?.name ?? `${PROVIDER_CONFIG[provider].name} Connection`)
    setTestResult(null)
    setModalOpen(true)
    if (conn?.config) {
      const cfg = conn.config as Record<string, string>
      if (provider === 'github') {
        setGithubForm({
          personal_access_token: '',
          organization: (cfg.organization as string) ?? '',
        })
      } else if (provider === 'azure_devops') {
        setAzureForm({
          organization_url: (cfg.organization_url as string) ?? '',
          personal_access_token: '',
          project: (cfg.project as string) ?? '',
        })
      } else if (provider === 'gitlab') {
        setGitlabForm({
          gitlab_url: (cfg.gitlab_url as string) ?? '',
          personal_access_token: '',
          project_id: (cfg.project_id as string) ?? '',
        })
      } else if (provider === 'jenkins') {
        setJenkinsForm({
          jenkins_url: (cfg.jenkins_url as string) ?? '',
          username: (cfg.username as string) ?? '',
          api_token: '',
        })
      }
    } else {
      setGithubForm({ personal_access_token: '', organization: '' })
      setAzureForm({ organization_url: '', personal_access_token: '', project: '' })
      setGitlabForm({ gitlab_url: '', personal_access_token: '', project_id: '' })
      setJenkinsForm({ jenkins_url: '', username: '', api_token: '' })
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setModalProvider(null)
    setEditingId(null)
    setTestResult(null)
  }

  const getConfigPayload = (): Record<string, unknown> => {
    if (modalProvider === 'github') {
      return {
        personal_access_token: githubForm.personal_access_token,
        organization: githubForm.organization || undefined,
      }
    }
    if (modalProvider === 'azure_devops') {
      return {
        organization_url: azureForm.organization_url,
        personal_access_token: azureForm.personal_access_token,
        project: azureForm.project,
      }
    }
    if (modalProvider === 'gitlab') {
      return {
        gitlab_url: gitlabForm.gitlab_url,
        personal_access_token: gitlabForm.personal_access_token,
        project_id: gitlabForm.project_id || undefined,
      }
    }
    if (modalProvider === 'jenkins') {
      return {
        jenkins_url: jenkinsForm.jenkins_url,
        username: jenkinsForm.username,
        api_token: jenkinsForm.api_token,
      }
    }
    return {}
  }

  const hasValidCredentials = (): boolean => {
    if (modalProvider === 'github') {
      return !!githubForm.personal_access_token
    }
    if (modalProvider === 'azure_devops') {
      return !!(
        azureForm.organization_url &&
        azureForm.personal_access_token &&
        azureForm.project
      )
    }
    if (modalProvider === 'gitlab') {
      return !!(gitlabForm.gitlab_url && gitlabForm.personal_access_token)
    }
    if (modalProvider === 'jenkins') {
      return !!(
        jenkinsForm.jenkins_url &&
        jenkinsForm.username &&
        jenkinsForm.api_token
      )
    }
    return false
  }

  const handleTest = async () => {
    if (!modalProvider || !projectId) return
    const config = getConfigPayload()
    setTesting(true)
    setTestResult(null)
    try {
      const { data } = await api.post<{ success: boolean; message: string }>(
        '/api/v1/cicd/connections/test',
        { provider: modalProvider, config },
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

  const handleSave = async () => {
    if (!modalProvider || !projectId) return
    const config = getConfigPayload()
    const hasCredentials = hasValidCredentials()
    setSaving(true)
    try {
      if (editingId) {
        const payload: Record<string, unknown> = { name: connectionName }
        if (hasCredentials) payload.config = config
        await api.patch(`/api/v1/cicd/connections/${editingId}`, payload, {
          params: { project_id: projectId },
        })
        toast.success('Connection updated')
      } else {
        await api.post(
          '/api/v1/cicd/connections',
          {
            provider: modalProvider,
            name: connectionName,
            config,
          },
          { params: { project_id: projectId } }
        )
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

  const handleDisconnect = async (conn: CICDConnection) => {
    if (!projectId || !confirm(`Disconnect ${conn.name}? This will remove the connection.`)) return
    setDisconnecting(conn.id)
    try {
      await api.delete(`/api/v1/cicd/connections/${conn.id}`, {
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

  const copyWebhook = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedWebhook(url)
    toast.success('Webhook URL copied')
    setTimeout(() => setCopiedWebhook(null), 2000)
  }

  const canSave = () => {
    if (!connectionName.trim()) return false
    if (editingId) return true
    return hasValidCredentials()
  }

  const getConnectionsForProvider = (p: Provider) =>
    connections.filter((c) => c.provider === p && c.is_active)

  if (!projectId) {
    return (
      <div className="text-gray-400 text-sm">Select a project to manage CI/CD connections.</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-white">CI/CD Providers</h3>
            <p className="text-sm text-gray-400 mt-1">
              Connect GitHub, Azure DevOps, GitLab, or Jenkins to track deployments and pipelines.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['github', 'azure_devops', 'gitlab', 'jenkins'] as Provider[]).map((provider) => {
              const conns = getConnectionsForProvider(provider)
              const cfg = PROVIDER_CONFIG[provider]
              const primaryConn = conns[0]
              const isConnected = conns.length > 0
              const count =
                conns.reduce((a, c) => a + (c.repos_count ?? 0) + (c.pipelines_count ?? 0), 0) ||
                conns.length

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
                              ? primaryConn?.status === 'connected'
                                ? 'bg-green-500/20 text-green-400'
                                : primaryConn?.status === 'error'
                                ? 'bg-red-500/20 text-red-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-600/50 text-gray-400'
                          }`}
                        >
                          {isConnected
                            ? primaryConn?.status === 'connected'
                              ? 'Connected'
                              : primaryConn?.status === 'error'
                              ? 'Error'
                              : 'Pending'
                            : 'Disconnected'}
                        </span>
                      </div>
                      {isConnected && conns.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {count} repos/pipelines
                        </p>
                      )}
                      {primaryConn?.webhook_url && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-xs text-gray-500 truncate">Webhook:</p>
                            <p className="text-xs text-gray-400 font-mono truncate">
                              {primaryConn.webhook_url}
                            </p>
                          </div>
                          <button
                            onClick={() => copyWebhook(primaryConn.webhook_url!)}
                            className="flex-shrink-0 p-1.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-400"
                          >
                            {copiedWebhook === primaryConn.webhook_url ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      )}
                      {primaryConn?.status_message && (
                        <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {primaryConn.status_message}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {isConnected && primaryConn ? (
                          <>
                            <button
                              onClick={() => openConnectModal(provider, primaryConn)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDisconnect(primaryConn)}
                              disabled={disconnecting === primaryConn.id}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {disconnecting === primaryConn.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unplug className="w-3.5 h-3.5" />
                              )}
                              Disconnect
                            </button>
                          </>
                        ) : null}
                        {primaryConn ? null : (
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
                placeholder="e.g. Production Pipeline"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
              />

              {modalProvider === 'github' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Personal Access Token *
                    </label>
                    <input
                      type="password"
                      value={githubForm.personal_access_token}
                      onChange={(e) =>
                        setGithubForm((f) => ({ ...f, personal_access_token: e.target.value }))
                      }
                      placeholder="ghp_..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Organization (optional)
                    </label>
                    <input
                      type="text"
                      value={githubForm.organization}
                      onChange={(e) =>
                        setGithubForm((f) => ({ ...f, organization: e.target.value }))
                      }
                      placeholder="my-org"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalProvider === 'azure_devops' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Organization URL *
                    </label>
                    <input
                      type="text"
                      value={azureForm.organization_url}
                      onChange={(e) =>
                        setAzureForm((f) => ({ ...f, organization_url: e.target.value }))
                      }
                      placeholder="https://dev.azure.com/myorg"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Personal Access Token *
                    </label>
                    <input
                      type="password"
                      value={azureForm.personal_access_token}
                      onChange={(e) =>
                        setAzureForm((f) => ({ ...f, personal_access_token: e.target.value }))
                      }
                      placeholder="••••••••••••••••"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Project *
                    </label>
                    <input
                      type="text"
                      value={azureForm.project}
                      onChange={(e) =>
                        setAzureForm((f) => ({ ...f, project: e.target.value }))
                      }
                      placeholder="MyProject"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalProvider === 'gitlab' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      GitLab URL *
                    </label>
                    <input
                      type="text"
                      value={gitlabForm.gitlab_url}
                      onChange={(e) =>
                        setGitlabForm((f) => ({ ...f, gitlab_url: e.target.value }))
                      }
                      placeholder="https://gitlab.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Personal Access Token *
                    </label>
                    <input
                      type="password"
                      value={gitlabForm.personal_access_token}
                      onChange={(e) =>
                        setGitlabForm((f) => ({ ...f, personal_access_token: e.target.value }))
                      }
                      placeholder="glpat-..."
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Project ID (optional)
                    </label>
                    <input
                      type="text"
                      value={gitlabForm.project_id}
                      onChange={(e) =>
                        setGitlabForm((f) => ({ ...f, project_id: e.target.value }))
                      }
                      placeholder="12345"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {modalProvider === 'jenkins' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Jenkins URL *
                    </label>
                    <input
                      type="text"
                      value={jenkinsForm.jenkins_url}
                      onChange={(e) =>
                        setJenkinsForm((f) => ({ ...f, jenkins_url: e.target.value }))
                      }
                      placeholder="https://jenkins.example.com"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={jenkinsForm.username}
                      onChange={(e) =>
                        setJenkinsForm((f) => ({ ...f, username: e.target.value }))
                      }
                      placeholder="admin"
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      API Token *
                    </label>
                    <input
                      type="password"
                      value={jenkinsForm.api_token}
                      onChange={(e) =>
                        setJenkinsForm((f) => ({ ...f, api_token: e.target.value }))
                      }
                      placeholder="••••••••••••••••"
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
