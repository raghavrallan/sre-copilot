import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Plus, Save, Trash2, Edit2, LayoutDashboard, Loader2 } from 'lucide-react'
import api from '../services/api'

type WidgetType = 'line' | 'area' | 'bar' | 'pie' | 'table' | 'billboard'

interface Widget {
  id: string
  type: WidgetType
  title: string
  query: string
}

interface ApiWidget {
  id: string
  title: string
  type: string
  metric_query: string
  width?: number
  height?: number
}

interface Dashboard {
  dashboard_id: string
  name: string
  description: string
  widgets: ApiWidget[]
  variables: Record<string, string>
  created_at?: string
  updated_at?: string
}

const PLACEHOLDER_CHART_DATA = [
  { name: 'A', value: 400 },
  { name: 'B', value: 300 },
  { name: 'C', value: 200 },
  { name: 'D', value: 278 },
]

const PLACEHOLDER_LINE_DATA = [
  { time: '10:00', v: 45 },
  { time: '10:15', v: 52 },
  { time: '10:30', v: 48 },
  { time: '10:45', v: 55 },
  { time: '11:00', v: 62 },
  { time: '11:15', v: 58 },
]

function apiWidgetToWidget(aw: ApiWidget): Widget {
  return {
    id: aw.id,
    type: (aw.type as WidgetType) || 'line',
    title: aw.title || 'Untitled',
    query: aw.metric_query || '',
  }
}

function widgetToApiWidget(w: Widget): ApiWidget {
  return {
    id: w.id,
    title: w.title,
    type: w.type,
    metric_query: w.query,
  }
}

export default function DashboardEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('New Dashboard')
  const [description, setDescription] = useState('')
  const [widgets, setWidgets] = useState<Widget[]>([])
  const [editingWidget, setEditingWidget] = useState<Widget | null>(null)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [vars, setVars] = useState<Record<string, string>>({ env: 'production', service: 'all' })

  useEffect(() => {
    if (isNew) {
      setLoading(false)
      setTitle('New Dashboard')
      setWidgets([])
      setVars({ env: 'production', service: 'all' })
      return
    }
    const fetchDashboard = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data } = await api.get<Dashboard>(`/api/v1/dashboards/${id}`)
        setTitle(data.name || 'Untitled')
        setDescription(data.description || '')
        setWidgets((data.widgets || []).map(apiWidgetToWidget))
        setVars(typeof data.variables === 'object' && data.variables ? data.variables : { env: 'production', service: 'all' })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [id, isNew])

  const addWidget = (type: WidgetType) => {
    const names: Record<WidgetType, string> = {
      line: 'Line Chart',
      area: 'Area Chart',
      bar: 'Bar Chart',
      pie: 'Pie Chart',
      table: 'Table',
      billboard: 'Billboard',
    }
    setWidgets((w) => [...w, { id: `${Date.now()}`, type, title: names[type], query: '' }])
    setShowAddMenu(false)
  }

  const deleteWidget = (widgetId: string) => {
    setWidgets((w) => w.filter((x) => x.id !== widgetId))
    setEditingWidget(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: title,
        description,
        widgets: widgets.map(widgetToApiWidget),
        variables: vars,
      }
      if (isNew) {
        const { data } = await api.post<Dashboard>('/api/v1/dashboards', payload)
        navigate(`/dashboards/${data.dashboard_id}`)
      } else {
        await api.put(`/api/v1/dashboards/${id}`, payload)
        navigate('/dashboards')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dashboard')
    } finally {
      setSaving(false)
    }
  }

  const renderWidget = (w: Widget) => {
    switch (w.type) {
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={PLACEHOLDER_LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Line type="monotone" dataKey="v" stroke="#3b82f6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={140}>
            <AreaChart data={PLACEHOLDER_LINE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Area type="monotone" dataKey="v" stroke="#10b981" fill="#10b98140" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={PLACEHOLDER_CHART_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
              <Bar dataKey="value" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      case 'pie':
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444']
        return (
          <ResponsiveContainer width="100%" height={140}>
            <PieChart>
              <Pie data={PLACEHOLDER_CHART_DATA} cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2} dataKey="value">
                {PLACEHOLDER_CHART_DATA.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }} />
            </PieChart>
          </ResponsiveContainer>
        )
      case 'billboard':
        return (
          <div className="flex items-center justify-center h-[140px]">
            <span className="text-4xl font-bold text-white">—</span>
            <span className="text-gray-400 ml-2">(query required)</span>
          </div>
        )
      case 'table':
        return (
          <div className="overflow-x-auto text-sm">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="px-2 py-1 text-left text-gray-400">Name</th>
                  <th className="px-2 py-1 text-left text-gray-400">Value</th>
                </tr>
              </thead>
              <tbody>
                {PLACEHOLDER_CHART_DATA.map((r) => (
                  <tr key={r.name} className="border-b border-gray-600/50">
                    <td className="px-2 py-1 text-white">{r.name}</td>
                    <td className="px-2 py-1 text-gray-300">{r.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      default:
        return <div className="text-gray-400 text-sm">Unknown widget</div>
    }
  }

  if (loading) {
    return (
      <div className="px-4 sm:px-0 flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0">
      {error && (
        <div className="mb-4 bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">
          {error}
        </div>
      )}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboards')} className="text-gray-400 hover:text-white">
            ← Back
          </button>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="text-2xl font-bold bg-transparent text-white border-none focus:ring-0 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboards')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <select
          value={vars.env ?? 'production'}
          onChange={(e) => setVars((v) => ({ ...v, env: e.target.value }))}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="production">production</option>
          <option value="staging">staging</option>
        </select>
        <select
          value={vars.service ?? 'all'}
          onChange={(e) => setVars((v) => ({ ...v, service: e.target.value }))}
          className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm"
        >
          <option value="all">All services</option>
          <option value="api-gateway">api-gateway</option>
          <option value="auth-service">auth-service</option>
        </select>
      </div>

      <div className="flex gap-6">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {widgets.map((w) => (
            <div
              key={w.id}
              className="bg-gray-800 rounded-lg border border-gray-700/50 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                <span className="text-sm font-medium text-white">{w.title}</span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setEditingWidget(w)}
                    className="p-1 text-gray-400 hover:text-white"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteWidget(w.id)}
                    className="p-1 text-gray-400 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 min-h-[160px]">{renderWidget(w)}</div>
            </div>
          ))}
        </div>

        <div className="w-64 flex-shrink-0">
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4 sticky top-4">
            <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
              <LayoutDashboard className="w-4 h-4" />
              Add Widget
            </h3>
            <div className="relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
              {showAddMenu && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 py-1 z-10">
                  {(['line', 'area', 'bar', 'pie', 'table', 'billboard'] as WidgetType[]).map((t) => (
                    <button
                      key={t}
                      onClick={() => addWidget(t)}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-gray-600 capitalize"
                    >
                      {t === 'billboard' ? 'Billboard' : t === 'line' ? 'Line Chart' : t === 'area' ? 'Area Chart' : t === 'bar' ? 'Bar Chart' : t === 'pie' ? 'Pie Chart' : 'Table'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {editingWidget && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-white mb-4">Edit Widget</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title</label>
                <input
                  value={editingWidget.title}
                  onChange={(e) => setEditingWidget((w) => w ? { ...w, title: e.target.value } : null)}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">SRE-QL Query</label>
                <textarea
                  value={editingWidget.query}
                  onChange={(e) => setEditingWidget((w) => w ? { ...w, query: e.target.value } : null)}
                  rows={4}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono text-sm"
                  placeholder="metric:http.request.duration | service:api-gateway"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingWidget(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setWidgets((ws) => ws.map((x) => (x.id === editingWidget.id ? editingWidget : x)))
                    setEditingWidget(null)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                >
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
