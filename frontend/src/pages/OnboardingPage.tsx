import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Key, Terminal, Server, Globe, Copy, Check, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'
import { useAuthStore } from '../lib/stores/auth-store'
import api from '../services/api'
import toast from 'react-hot-toast'

const API_BASE = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8580'
const COLLECTOR_URL = `${API_BASE.replace(/\/$/, '')}/api/v1/ingest`

type Step = 1 | 2 | 3
type AgentTab = 'python' | 'infra' | 'browser'

interface ApiKeyCreated {
  id: string
  name: string
  key_prefix: string
  raw_key: string
  scopes: string[]
  is_active: boolean
  created_at: string
}

export default function OnboardingPage() {
  const { currentProject } = useAuthStore()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [agentTab, setAgentTab] = useState<AgentTab>('python')
  const [apiKey, setApiKey] = useState<ApiKeyCreated | null>(null)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [services, setServices] = useState<{ service_name: string }[]>([])
  const [registryLoading, setRegistryLoading] = useState(false)

  const projectId = currentProject?.id
  const projectName = currentProject?.name

  useEffect(() => {
    if (!projectId) return
    navigate('/')
  }, [projectId, navigate])

  const handleGenerateKey = async () => {
    if (!projectId) return
    setGenerating(true)
    try {
      const { data } = await api.post<ApiKeyCreated>(
        `/api/v1/projects/${projectId}/api-keys`,
        { name: 'Default Agent Key' }
      )
      setApiKey(data)
      setStep(2)
      toast.success('API key generated')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate API key'
      toast.error(msg)
    } finally {
      setGenerating(false)
    }
  }

  const copyKey = async () => {
    if (!apiKey?.raw_key) return
    await navigator.clipboard.writeText(apiKey.raw_key)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  // Poll services registry every 5 seconds when on step 3
  useEffect(() => {
    if (step !== 3 || !projectId) return

    const poll = async () => {
      setRegistryLoading(true)
      try {
        const { data } = await api.get<{ service_name: string }[]>(
          `/api/v1/services/registry?project_id=${projectId}`
        )
        setServices(Array.isArray(data) ? data : [])
      } catch {
        setServices([])
      } finally {
        setRegistryLoading(false)
      }
    }

    poll()
    const id = setInterval(poll, 5000)
    return () => clearInterval(id)
  }, [step, projectId])

  const getCodeSnippet = () => {
    const key = apiKey?.raw_key || 'YOUR_KEY_HERE'

    switch (agentTab) {
      case 'python':
        return `pip install sre-copilot-sdk

from sre_copilot_sdk import SRECopilotClient, SRECopilotMiddleware

client = SRECopilotClient(
    api_key="${key}",
    collector_url="${COLLECTOR_URL}",
    service_name="my-api"
)

# FastAPI middleware
app.add_middleware(SRECopilotMiddleware, client=client, service_name="my-api")`

      case 'infra':
        return `pip install sre-copilot-agent

# Or run with Docker:
docker run -e API_KEY=${key} \\
  -e COLLECTOR_URL=${COLLECTOR_URL} \\
  sre-copilot/infra-agent

# Or run directly:
API_KEY=${key} COLLECTOR_URL=${COLLECTOR_URL} python agent.py`

      case 'browser':
        return `npm install @sre-copilot/browser-sdk

import { SREBrowserSDK } from '@sre-copilot/browser-sdk';

SREBrowserSDK.init({
  collectorUrl: '${COLLECTOR_URL}',
  apiKey: '${key}',
  appName: 'my-web-app'
});`
      default:
        return ''
    }
  }

  if (!projectId) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Getting Started</h1>
        <p className="text-gray-400 text-sm mb-8">
          Set up monitoring for <span className="text-white font-medium">{projectName}</span>
        </p>

        {/* Step indicator */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <button
              key={s}
              onClick={() => s < step && setStep(s as Step)}
              className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-medium transition-colors ${
                s === step
                  ? 'bg-blue-600 text-white'
                  : s < step
                    ? 'bg-blue-600/50 text-white cursor-pointer hover:bg-blue-600/70'
                    : 'bg-gray-700 text-gray-400'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* Step 1: Generate API Key */}
        {step === 1 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600/20">
                <Key className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Generate API Key</h2>
                <p className="text-sm text-gray-400">Create a key for your agents and SDKs</p>
              </div>
            </div>

            {!apiKey ? (
              <button
                onClick={handleGenerateKey}
                disabled={generating}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Generate API Key
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 p-3 bg-gray-900 rounded-lg font-mono text-sm text-gray-300 break-all">
                  <span className="flex-1">{apiKey.raw_key}</span>
                  <button
                    onClick={copyKey}
                    className="flex-shrink-0 p-2 rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                  >
                    {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-2 p-3 bg-amber-900/30 border border-amber-700/50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-200">
                    Save this key! It won&apos;t be shown again.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Install Agent */}
        {step === 2 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600/20">
                <Terminal className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Install an Agent</h2>
                <p className="text-sm text-gray-400">Choose your integration and follow the instructions</p>
              </div>
            </div>

            <div className="flex gap-2 mb-4 border-b border-gray-700 pb-2">
              {[
                { id: 'python' as AgentTab, label: 'Python SDK', icon: Terminal },
                { id: 'infra' as AgentTab, label: 'Infrastructure Agent', icon: Server },
                { id: 'browser' as AgentTab, label: 'Browser SDK', icon: Globe },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setAgentTab(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    agentTab === id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <pre className="p-4 bg-gray-900 rounded-lg text-sm text-gray-300 overflow-x-auto whitespace-pre-wrap font-mono">
              {getCodeSnippet()}
            </pre>

            <div className="mt-6 flex justify-between">
              <button
                onClick={() => setStep(1)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Next: Verify Connection
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Verify Connection */}
        {step === 3 && (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600/20">
                <CheckCircle className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Verify Connection</h2>
                <p className="text-sm text-gray-400">Waiting for your agent to send data</p>
              </div>
            </div>

            {registryLoading && services.length === 0 ? (
              <div className="flex items-center gap-3 p-6 bg-gray-900 rounded-lg">
                <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
                <span className="text-gray-400">Waiting for data...</span>
              </div>
            ) : services.length > 0 ? (
              <div className="p-6 bg-green-900/20 border border-green-700/50 rounded-lg">
                <div className="flex items-center gap-3 text-green-400">
                  <CheckCircle className="w-8 h-8" />
                  <div>
                    <p className="font-semibold text-white">Connected!</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {services.length} service{services.length !== 1 ? 's' : ''} detected:{' '}
                      {services.map((s) => s.service_name).join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/')}
                  className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Go to Dashboard
                </button>
              </div>
            ) : (
              <div className="p-6 bg-gray-900 rounded-lg">
                <p className="text-gray-400 mb-4">
                  Run your agent with the API key and wait for data to appear. Polling every 5 seconds.
                </p>
                <button
                  onClick={() => setStep(2)}
                  className="text-blue-400 hover:text-blue-300 text-sm"
                >
                  Back to installation
                </button>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={() => setStep(2)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
