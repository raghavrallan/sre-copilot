import { useState, useEffect } from 'react'
import { GitCommit, CheckCircle, Loader2, AlertCircle, GitBranch } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import api from '../services/api'

interface DeploymentApi {
  deployment_id: string
  service: string
  version: string
  commit_sha: string
  description: string
  deployed_by: string
  timestamp: string
}

interface Deployment {
  id: string
  service: string
  version: string
  commitSha: string
  description: string
  deployedBy: string
  timestamp: string
  status: 'success'
}

function mapApiToDeployment(raw: DeploymentApi): Deployment {
  return {
    id: raw.deployment_id,
    service: raw.service,
    version: raw.version,
    commitSha: raw.commit_sha,
    description: raw.description,
    deployedBy: raw.deployed_by,
    timestamp: raw.timestamp,
    status: 'success',
  }
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serviceFilter, setServiceFilter] = useState('')
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)

  const services = Array.from(new Set(deployments.map((d) => d.service))).sort()
  const filtered = !serviceFilter
    ? deployments
    : deployments.filter((d) => d.service === serviceFilter)

  useEffect(() => {
    let cancelled = false
    async function fetchDeployments() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<DeploymentApi[]>('/api/v1/deployments', {
          params: { limit: 50 },
        })
        if (!cancelled) {
          setDeployments((data || []).map(mapApiToDeployment))
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err && typeof err === 'object' && 'response' in err
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : 'Failed to load deployments'
          setError(typeof msg === 'string' ? msg : 'Failed to load deployments')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDeployments()
    return () => { cancelled = true }
  }, [])

  const getStatusIcon = () => <CheckCircle className="w-5 h-5 text-green-500" />

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
          <GitCommit className="w-8 h-8 text-blue-400" />
          Deployments & Changes
        </h1>
        <select
          value={serviceFilter}
          onChange={(e) => setServiceFilter(e.target.value)}
          className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-8">
        <div className="flex-1">
          {deployments.length === 0 ? (
            <div className="bg-gray-800 rounded-lg border border-gray-700/50">
              <EmptyState
                icon={<GitBranch size={32} />}
                title="No deployments tracked"
                description="Connect your CI/CD pipeline (GitHub, Azure DevOps) to track deployments automatically."
              />
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />
              <div className="space-y-0">
                {filtered.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => setSelectedDeployment(d)}
                    className={`relative pl-12 pb-8 cursor-pointer group ${
                      selectedDeployment?.id === d.id ? 'ring-2 ring-blue-500/50 rounded-lg -m-2 p-2' : ''
                    }`}
                  >
                    <div className="absolute left-2 top-1 w-4 h-4 rounded-full bg-gray-600 group-hover:bg-gray-500" />
                    <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">{d.service}</span>
                            <span className="text-sm text-gray-400">v{d.version}</span>
                            <code className="text-xs text-gray-500 font-mono">{d.commitSha}</code>
                          </div>
                          <p className="text-white font-medium mb-1">{d.description}</p>
                          <p className="text-sm text-gray-400">
                            {d.deployedBy} • {new Date(d.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getStatusIcon()}
                          <span className="text-sm text-gray-400">Success</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedDeployment && (
          <div className="w-80 flex-shrink-0 space-y-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Deployment Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Service</span>
                  <span className="text-white">{selectedDeployment.service}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Version</span>
                  <span className="text-white">v{selectedDeployment.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Commit</span>
                  <span className="text-white font-mono text-xs">{selectedDeployment.commitSha}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Deployed by</span>
                  <span className="text-white">{selectedDeployment.deployedBy}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Time</span>
                  <span className="text-white">{new Date(selectedDeployment.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <p className="mt-3 text-gray-300 text-sm">{selectedDeployment.description}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
