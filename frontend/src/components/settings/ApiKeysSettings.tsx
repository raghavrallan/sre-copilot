import { useState, useEffect } from 'react'
import { Key, Copy, Check, Plus, AlertTriangle } from 'lucide-react'
import { useAuthStore } from '../../lib/stores/auth-store'
import api from '../../services/api'
import toast from 'react-hot-toast'

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  scopes: string[]
  is_active: boolean
  last_used_at: string | null
  created_at: string
  expires_at?: string | null
}

interface ApiKeyCreated extends ApiKey {
  raw_key: string
}

export default function ApiKeysSettings() {
  const { currentProject } = useAuthStore()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [creating, setCreating] = useState(false)
  const [newKeyResult, setNewKeyResult] = useState<ApiKeyCreated | null>(null)
  const [copied, setCopied] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [revoking, setRevoking] = useState<string | null>(null)

  const projectId = currentProject?.id

  const fetchKeys = async () => {
    if (!projectId) return
    setLoading(true)
    try {
      const { data } = await api.get<ApiKey[]>(`/api/v1/projects/${projectId}/api-keys`)
      setKeys(Array.isArray(data) ? data : [])
    } catch {
      setKeys([])
      toast.error('Failed to load API keys')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [projectId])

  const handleCreate = async () => {
    if (!projectId || !newKeyName.trim()) return
    setCreating(true)
    try {
      const { data } = await api.post<ApiKeyCreated>(
        `/api/v1/projects/${projectId}/api-keys`,
        { name: newKeyName.trim() }
      )
      setNewKeyResult(data)
      setNewKeyName('')
      toast.success('API key created')
      fetchKeys()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create API key'
      toast.error(msg)
    } finally {
      setCreating(false)
    }
  }

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggle = async (keyId: string, isActive: boolean) => {
    if (!projectId) return
    setToggling(keyId)
    try {
      await api.patch(`/api/v1/projects/${projectId}/api-keys/${keyId}`, {
        is_active: !isActive,
      })
      toast.success(isActive ? 'Key deactivated' : 'Key activated')
      fetchKeys()
    } catch {
      toast.error('Failed to update key')
    } finally {
      setToggling(null)
    }
  }

  const handleRevoke = async (keyId: string) => {
    if (!projectId) return
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return
    setRevoking(keyId)
    try {
      await api.delete(`/api/v1/projects/${projectId}/api-keys/${keyId}`)
      toast.success('API key revoked')
      fetchKeys()
    } catch {
      toast.error('Failed to revoke key')
    } finally {
      setRevoking(null)
    }
  }

  const closeModal = () => {
    setModalOpen(false)
    setNewKeyResult(null)
    setNewKeyName('')
  }

  const formatDate = (d: string | null) => {
    if (!d) return '—'
    try {
      return new Date(d).toLocaleDateString(undefined, {
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

  if (!projectId) {
    return (
      <div className="text-gray-500 text-sm">Select a project to manage API keys.</div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-gray-900">API Keys</h3>
            <p className="text-sm text-gray-500 mt-1">
              Manage API keys for agents and SDKs. Keys authenticate ingest requests.
            </p>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Generate New Key
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : keys.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-300 rounded-lg">
            <Key className="w-10 h-10 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No API keys yet</p>
            <p className="text-xs text-gray-500 mt-1">Generate a key to connect your agents</p>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-3 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Generate New Key
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Key Prefix
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Scopes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Used
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{key.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                      {key.key_prefix}...
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {Array.isArray(key.scopes) ? key.scopes.length : 0} scopes
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(key.last_used_at)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(key.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-medium rounded ${
                          key.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {key.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(key.id, key.is_active)}
                          disabled={toggling === key.id}
                          className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                        >
                          {toggling === key.id ? '...' : key.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => handleRevoke(key.id)}
                          disabled={revoking === key.id}
                          className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                        >
                          {revoking === key.id ? '...' : 'Revoke'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Key Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            {!newKeyResult ? (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate New Key</h3>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. Production Agent"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Generate'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">API Key Created</h3>
                <div className="flex items-center gap-2 p-3 bg-gray-100 rounded-lg font-mono text-sm text-gray-800 break-all">
                  <span className="flex-1">{newKeyResult.raw_key}</span>
                  <button
                    onClick={() => copyKey(newKeyResult.raw_key)}
                    className="flex-shrink-0 p-2 rounded bg-gray-200 hover:bg-gray-300"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-2 p-3 mt-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Save this key! It won&apos;t be shown again.
                  </p>
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
