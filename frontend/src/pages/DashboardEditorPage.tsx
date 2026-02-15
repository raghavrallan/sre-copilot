import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Plus, Save, Loader2, ArrowLeft } from 'lucide-react'
import api from '../services/api'
import WidgetTypePicker, { type WidgetType } from '../components/dashboard/editor/WidgetTypePicker'
import WidgetConfigPanel, { type WidgetConfig, type WidgetSize } from '../components/dashboard/editor/WidgetConfigPanel'
import WidgetCard from '../components/dashboard/editor/WidgetCard'
import TemplateWidgets from '../components/dashboard/editor/TemplateWidgets'

interface ApiWidget {
  id: string
  title: string
  type: string
  metric_query: string
  width?: number
  height?: number
  size?: string
}

interface DashboardData {
  dashboard_id: string
  name: string
  description: string
  widgets: ApiWidget[]
  variables: Record<string, string>
}

function apiToWidget(aw: ApiWidget): WidgetConfig {
  let size: WidgetSize = '1/3'
  if (aw.size === '1/2' || aw.size === '2/3' || aw.size === 'full') size = aw.size as WidgetSize
  else if (aw.width && aw.width >= 4) size = 'full'
  else if (aw.width && aw.width >= 3) size = '2/3'
  else if (aw.width && aw.width >= 2) size = '1/2'
  return { id: aw.id, type: (aw.type as WidgetType) || 'line', title: aw.title || 'Untitled', query: aw.metric_query || '', size }
}

function widgetToApi(w: WidgetConfig): ApiWidget {
  return { id: w.id, title: w.title, type: w.type, metric_query: w.query, size: w.size }
}

export default function DashboardEditorPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = !id || id === 'new'

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [title, setTitle] = useState('New Dashboard')
  const [description, setDescription] = useState('')
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [showTypePicker, setShowTypePicker] = useState(false)
  const [editingWidget, setEditingWidget] = useState<WidgetConfig | null>(null)
  const [liveData, setLiveData] = useState<Record<string, any[] | null>>({})
  const [liveLoading, setLiveLoading] = useState<Record<string, boolean>>({})
  const dragIndexRef = useRef<number | null>(null)

  // Load existing dashboard
  useEffect(() => {
    if (isNew) { setLoading(false); return }
    const fetchDashboard = async () => {
      setLoading(true)
      try {
        const { data } = await api.get<DashboardData>(`/api/v1/dashboards/${id}`)
        setTitle(data.name || 'Untitled')
        setDescription(data.description || '')
        setWidgets((data.widgets || []).map(apiToWidget))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [id, isNew])

  // Fetch live data for widgets with queries
  const fetchLiveData = useCallback(async (widget: WidgetConfig) => {
    if (!widget.query) return
    setLiveLoading(prev => ({ ...prev, [widget.id]: true }))
    try {
      // Try to fetch real data based on query patterns
      let data: any[] | null = null
      const q = widget.query.toLowerCase()

      if (q.includes('incidents') && q.includes('severity')) {
        const res = await api.get('/api/v1/incidents-stats')
        const stats = res.data
        if (stats?.by_severity) {
          data = Object.entries(stats.by_severity).map(([name, value]) => ({ name, value }))
        }
      } else if (q.includes('incidents') && q.includes('active')) {
        const res = await api.get('/api/v1/incidents-stats')
        const stats = res.data
        data = [{ name: 'Active', value: (stats?.by_state?.open || 0) + (stats?.by_state?.investigating || 0) }]
      } else if (q.includes('error') && q.includes('service')) {
        const res = await api.get('/api/v1/metrics/services-overview')
        const services = Array.isArray(res.data?.services) ? res.data.services : (Array.isArray(res.data) ? res.data : [])
        data = services.slice(0, 10).map((s: any) => ({
          name: s.name || s.service_name || 'unknown',
          value: Math.round((s.errorRate ?? s.error_rate ?? 0) * 100) / 100,
        }))
      } else if (q.includes('duration') || q.includes('latency')) {
        const res = await api.get('/api/v1/metrics/services-overview')
        const services = Array.isArray(res.data?.services) ? res.data.services : (Array.isArray(res.data) ? res.data : [])
        data = services.slice(0, 10).map((s: any) => ({
          name: s.name || s.service_name || 'unknown',
          value: Math.round(s.avgResponseTime ?? s.avg_response_time ?? 0),
        }))
      } else if (q.includes('throughput') || q.includes('request.count')) {
        const res = await api.get('/api/v1/metrics/services-overview')
        const services = Array.isArray(res.data?.services) ? res.data.services : (Array.isArray(res.data) ? res.data : [])
        data = services.slice(0, 10).map((s: any) => ({
          name: s.name || s.service_name || 'unknown',
          value: s.throughput ?? 0,
        }))
      } else if (q.includes('errors') && q.includes('group:message')) {
        const res = await api.get('/api/v1/errors/groups')
        const groups = Array.isArray(res.data?.groups) ? res.data.groups : (Array.isArray(res.data) ? res.data : [])
        data = groups.slice(0, 10).map((g: any) => ({
          name: g.message || g.type || 'unknown',
          value: g.count || g.occurrences || 0,
        }))
      }

      setLiveData(prev => ({ ...prev, [widget.id]: data }))
    } catch {
      setLiveData(prev => ({ ...prev, [widget.id]: null }))
    } finally {
      setLiveLoading(prev => ({ ...prev, [widget.id]: false }))
    }
  }, [])

  // Fetch live data for all widgets on mount / widget change
  useEffect(() => {
    widgets.forEach(w => {
      if (w.query) fetchLiveData(w)
    })
  }, [widgets.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // Add widget from type picker
  const addWidget = (type: WidgetType) => {
    const names: Record<WidgetType, string> = {
      line: 'Line Chart', area: 'Area Chart', bar: 'Bar Chart',
      pie: 'Pie Chart', table: 'Table', billboard: 'Billboard',
    }
    const newWidget: WidgetConfig = {
      id: `w-${Date.now()}`, type, title: names[type], query: '', size: '1/3',
    }
    setWidgets(prev => [...prev, newWidget])
    setShowTypePicker(false)
  }

  // Add from template
  const addFromTemplate = (template: Omit<WidgetConfig, 'id'>) => {
    const newWidget: WidgetConfig = { ...template, id: `w-${Date.now()}` }
    setWidgets(prev => [...prev, newWidget])
    fetchLiveData(newWidget)
  }

  // Save widget config
  const saveWidgetConfig = (updated: WidgetConfig) => {
    setWidgets(prev => prev.map(w => w.id === updated.id ? updated : w))
    setEditingWidget(null)
    if (updated.query) fetchLiveData(updated)
  }

  // Delete widget
  const deleteWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId))
  }

  // Drag and drop reordering
  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (_index: number) => (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (dropIndex: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const dragIndex = dragIndexRef.current
    if (dragIndex === null || dragIndex === dropIndex) return
    setWidgets(prev => {
      const copy = [...prev]
      const [dragged] = copy.splice(dragIndex, 1)
      copy.splice(dropIndex, 0, dragged)
      return copy
    })
    dragIndexRef.current = null
  }

  // Save dashboard
  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: title,
        description,
        widgets: widgets.map(widgetToApi),
        variables: {},
      }
      if (isNew) {
        const { data } = await api.post<DashboardData>('/api/v1/dashboards', payload)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 sm:px-0 pb-8">
      {/* Error banner */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/dashboards')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold text-gray-900 bg-transparent border-none focus:outline-none focus:ring-0 w-full"
              placeholder="Dashboard title"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm text-gray-500 bg-transparent border-none focus:outline-none focus:ring-0 w-full mt-0.5"
              placeholder="Add a description..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/dashboards')}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex gap-6">
        {/* Widget grid */}
        <div className="flex-1 min-w-0">
          {widgets.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-2xl p-12 text-center">
              <Plus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <h3 className="text-lg font-medium text-gray-600 mb-1">No widgets yet</h3>
              <p className="text-sm text-gray-400 mb-4">Add widgets from the panel on the right, or use a quick template</p>
              <button
                onClick={() => setShowTypePicker(true)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add First Widget
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {widgets.map((w, index) => (
                <WidgetCard
                  key={w.id}
                  widget={w}
                  liveData={liveData[w.id]}
                  liveLoading={liveLoading[w.id]}
                  onEdit={() => setEditingWidget(w)}
                  onDelete={() => deleteWidget(w.id)}
                  onDragStart={handleDragStart(index)}
                  onDragOver={handleDragOver(index)}
                  onDrop={handleDrop(index)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4">
          {/* Add widget button */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <button
              onClick={() => setShowTypePicker(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
          </div>

          {/* Templates */}
          <TemplateWidgets onAdd={addFromTemplate} />

          {/* Widget count */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{widgets.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">widget{widgets.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Type picker modal */}
      {showTypePicker && (
        <WidgetTypePicker
          onSelect={addWidget}
          onClose={() => setShowTypePicker(false)}
        />
      )}

      {/* Config panel modal */}
      {editingWidget && (
        <WidgetConfigPanel
          widget={editingWidget}
          onSave={saveWidgetConfig}
          onClose={() => setEditingWidget(null)}
        />
      )}
    </div>
  )
}
