import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Eye, EyeOff, Loader2, Plug, Check, AlertCircle } from 'lucide-react'
import { useAuthStore } from '../../../stores/auth-store'
import api from '../../../services/api'
import toast from 'react-hot-toast'

interface ConnectionRecord {
  id: string
  category: string
  name: string
  config_display: Record<string, unknown>
  is_active: boolean
  last_tested_at: string | null
  last_test_status: string
  created_at?: string
  updated_at?: string
}

const SECTION_CATEGORIES: Record<string, { label: string; categories: string[] }> = {
  database: { label: 'Database', categories: ['database'] },
  redis: { label: 'Cache (Redis)', categories: ['redis'] },
  ai: { label: 'AI Service', categories: ['ai_openai', 'ai_azure_openai'] },
  observability: {
    label: 'Observability',
    categories: ['observability_prometheus', 'observability_grafana', 'observability_alertmanager'],
  },
}

const CATEGORY_FIELDS: Record<string, { label: string; fields: { key: string; label: string; type: 'text' | 'password' | 'number'; placeholder?: string }[] }> = {
  database: {
    label: 'PostgreSQL',
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '5432' },
      { key: 'dbname', label: 'Database Name', type: 'text', placeholder: 'sre_copilot' },
      { key: 'user', label: 'Username', type: 'text', placeholder: 'postgres' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'ssl_mode', label: 'SSL Mode', type: 'text', placeholder: 'prefer' },
    ],
  },
  redis: {
    label: 'Redis',
    fields: [
      { key: 'host', label: 'Host', type: 'text', placeholder: 'localhost' },
      { key: 'port', label: 'Port', type: 'number', placeholder: '6379' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'db', label: 'Database Index', type: 'number', placeholder: '0' },
    ],
  },
  ai_openai: {
    label: 'OpenAI',
    fields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'model', label: 'Model', type: 'text', placeholder: 'gpt-4o-mini' },
    ],
  },
  ai_azure_openai: {
    label: 'Azure OpenAI',
    fields: [
      { key: 'endpoint', label: 'Endpoint', type: 'text', placeholder: 'https://your-resource.openai.azure.com' },
      { key: 'api_key', label: 'API Key', type: 'password' },
      { key: 'deployment', label: 'Deployment Name', type: 'text' },
    ],
  },
  observability_prometheus: {
    label: 'Prometheus',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'http://prometheus:9090' },
    ],
  },
  observability_grafana: {
    label: 'Grafana',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'http://grafana:3000' },
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
  },
  observability_alertmanager: {
    label: 'AlertManager',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'http://alertmanager:9093' },
    ],
  },
}

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className="text-base font-semibold text-gray-900">{title}</span>
        {open ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
      </button>
      {open && <div className="px-6 pb-6 pt-0 border-t border-gray-100">{children}</div>}
    </div>
  )
}

function PasswordInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  )
}

function CategoryForm({
  category,
  existingRecord,
  onSave,
  onTest,
  saveLoading,
  testLoading,
  testResult,
}: {
  category: string
  existingRecord: ConnectionRecord | null
  onSave: (category: string, config: Record<string, unknown>, existingId?: string) => void
  onTest: (category: string, config: Record<string, unknown>) => void
  saveLoading: boolean
  testLoading: boolean
  testResult: { success: boolean; message: string } | null
}) {
  const fieldDef = CATEGORY_FIELDS[category]
  if (!fieldDef) return null

  const [formData, setFormData] = useState<Record<string, string | number>>(() => {
    const initial: Record<string, string | number> = {}
    for (const f of fieldDef.fields) {
      const displayVal = existingRecord?.config_display?.[f.key]
      if (f.type === 'password') {
        initial[f.key] = ''
      } else {
        initial[f.key] = displayVal != null ? String(displayVal) : ''
      }
    }
    return initial
  })

  const update = (key: string, value: string | number) => {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  const buildConfig = (): Record<string, unknown> => {
    const config: Record<string, unknown> = {}
    for (const f of fieldDef.fields) {
      const val = formData[f.key]
      if (val !== '' && val !== undefined) {
        config[f.key] = f.type === 'number' ? Number(val) : val
      }
    }
    return config
  }

  return (
    <div className="pt-4">
      <h4 className="text-sm font-medium text-gray-700 mb-3">{fieldDef.label}</h4>
      <div className="grid grid-cols-2 gap-4">
        {fieldDef.fields.map((f) =>
          f.type === 'password' ? (
            <div key={f.key} className={fieldDef.fields.length > 2 ? '' : 'col-span-2'}>
              <PasswordInput
                label={f.label}
                value={String(formData[f.key] ?? '')}
                onChange={(v) => update(f.key, v)}
                placeholder={existingRecord ? 'Leave blank to keep' : f.placeholder}
              />
            </div>
          ) : (
            <div key={f.key}>
              <label className="block text-xs font-medium text-gray-500 mb-1">{f.label}</label>
              <input
                type={f.type}
                value={formData[f.key] ?? ''}
                onChange={(e) => update(f.key, f.type === 'number' ? Number(e.target.value) : e.target.value)}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              />
            </div>
          )
        )}
      </div>

      {existingRecord && (
        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          <span>Status: <span className={existingRecord.last_test_status === 'success' ? 'text-green-600 font-medium' : existingRecord.last_test_status === 'failed' ? 'text-red-600 font-medium' : 'text-gray-500'}>{existingRecord.last_test_status || 'Not tested'}</span></span>
          {existingRecord.last_tested_at && (
            <span>Last tested: {new Date(existingRecord.last_tested_at).toLocaleString()}</span>
          )}
        </div>
      )}

      {testResult && (
        <div className={`mt-3 flex items-center gap-2 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {testResult.success ? <Check className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
          {testResult.message}
        </div>
      )}

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() => onTest(category, buildConfig())}
          disabled={testLoading}
          className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 flex items-center gap-2"
        >
          {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
          Test Connection
        </button>
        <button
          type="button"
          onClick={() => onSave(category, buildConfig(), existingRecord?.id)}
          disabled={saveLoading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save
        </button>
      </div>
    </div>
  )
}

export default function ConnectionSettings() {
  const { currentProject } = useAuthStore()
  const projectId = currentProject?.id

  const [records, setRecords] = useState<ConnectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saveLoading, setSaveLoading] = useState<string | null>(null)
  const [testLoading, setTestLoading] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({})

  const loadConnections = useCallback(async () => {
    try {
      setLoading(true)
      const { data } = await api.get<ConnectionRecord[]>('/api/v1/settings/connections')
      setRecords(Array.isArray(data) ? data : [])
    } catch (err: any) {
      if (err.response?.status === 404) {
        setRecords([])
      } else {
        toast.error(err.response?.data?.detail || 'Failed to load connections')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (projectId) loadConnections()
  }, [projectId, loadConnections])

  const getRecordForCategory = (category: string): ConnectionRecord | null =>
    records.find((r) => r.category === category) ?? null

  const handleSave = async (category: string, config: Record<string, unknown>, existingId?: string) => {
    setSaveLoading(category)
    try {
      const label = CATEGORY_FIELDS[category]?.label ?? category.replace(/_/g, ' ')
      await api.put('/api/v1/settings/connections', {
        id: existingId || undefined,
        category,
        name: label,
        config,
      })
      toast.success('Connection saved')
      loadConnections()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save connection')
    } finally {
      setSaveLoading(null)
    }
  }

  const handleTest = async (category: string, config: Record<string, unknown>) => {
    setTestLoading(category)
    setTestResults((prev) => ({ ...prev, [category]: undefined as any }))
    try {
      const existing = getRecordForCategory(category)
      const payload: Record<string, unknown> = { category, config }
      if (existing) payload.connection_id = existing.id

      const { data } = await api.post<{ success: boolean; message: string }>(
        '/api/v1/settings/connections/test',
        payload,
      )
      const result = {
        success: data?.success ?? false,
        message: data?.message ?? (data?.success ? 'Connection successful' : 'Connection failed'),
      }
      setTestResults((prev) => ({ ...prev, [category]: result }))
      if (result.success) {
        toast.success('Connection test successful')
        loadConnections()
      } else {
        toast.error(result.message)
      }
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Connection test failed'
      setTestResults((prev) => ({ ...prev, [category]: { success: false, message: msg } }))
      toast.error(msg)
    } finally {
      setTestLoading(null)
    }
  }

  if (!projectId) {
    return <div className="text-gray-500 text-sm">Select a project to manage connections.</div>
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500 mb-6">
        Configure connection settings for backend services. Changes are saved per section.
      </p>

      {Object.entries(SECTION_CATEGORIES).map(([sectionKey, section]) => (
        <CollapsibleSection key={sectionKey} title={section.label} defaultOpen={sectionKey === 'database'}>
          {section.categories.map((cat) => (
            <CategoryForm
              key={cat}
              category={cat}
              existingRecord={getRecordForCategory(cat)}
              onSave={handleSave}
              onTest={handleTest}
              saveLoading={saveLoading === cat}
              testLoading={testLoading === cat}
              testResult={testResults[cat] ?? null}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  )
}
