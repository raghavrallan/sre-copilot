import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  ArrowLeft, BarChart3, Brain, ChevronDown, ChevronRight,
  ExternalLink, Folder, Gauge, Loader2, AlertTriangle,
  CheckCircle2, Info, Tag, Code2, Activity, Table2,
  PieChart, Flame, Type, Clock, Maximize2, RefreshCw, Pause, Play,
} from 'lucide-react'
import api from '../services/api'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PanelTarget { expr: string; legendFormat: string; refId: string; datasource: any }
interface GrafanaPanel {
  id: number; title: string; type: string; description: string
  datasource: any; gridPos: { x: number; y: number; w: number; h: number }
  targets: PanelTarget[]; thresholds: any; alert: any
}
interface DashboardSection { title: string; collapsed: boolean; panels: GrafanaPanel[] }
interface DashboardDetail {
  uid: string; title: string; description: string; tags: string[]
  timezone: string; version: number; folder: string
  created: string; updated: string; grafana_url: string
  panels: GrafanaPanel[]; sections: DashboardSection[]
}
interface Insight { severity: 'critical' | 'warning' | 'info'; title: string; description: string; recommendation: string }
interface AnalysisResult { dashboard_title: string; summary: string; insights: Insight[]; ai_powered: boolean }
interface SeriesData { name: string; ref_id: string; data: { t: number; v: number }[] }

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const PANEL_META: Record<string, { icon: typeof BarChart3; color: string; label: string }> = {
  timeseries: { icon: Activity, color: '#3b82f6', label: 'Time Series' },
  graph: { icon: Activity, color: '#3b82f6', label: 'Graph' },
  gauge: { icon: Gauge, color: '#10b981', label: 'Gauge' },
  stat: { icon: Gauge, color: '#8b5cf6', label: 'Stat' },
  bargauge: { icon: BarChart3, color: '#f59e0b', label: 'Bar Gauge' },
  barchart: { icon: BarChart3, color: '#f59e0b', label: 'Bar Chart' },
  table: { icon: Table2, color: '#6b7280', label: 'Table' },
  text: { icon: Type, color: '#9ca3af', label: 'Text' },
  heatmap: { icon: Flame, color: '#ef4444', label: 'Heatmap' },
  piechart: { icon: PieChart, color: '#ec4899', label: 'Pie Chart' },
  logs: { icon: Code2, color: '#06b6d4', label: 'Logs' },
}

const SEV = {
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-red-800', badge: 'bg-red-600', icon: AlertTriangle },
  warning: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-800', badge: 'bg-amber-500', icon: AlertTriangle },
  info: { bg: 'bg-blue-50 border-blue-200', text: 'text-blue-800', badge: 'bg-blue-600', icon: Info },
}

/* ------------------------------------------------------------------ */
/*  Fetch queue: limit concurrent panel data requests                  */
/* ------------------------------------------------------------------ */

class FetchQueue {
  private q: (() => void)[] = []
  private active = 0
  constructor(private max: number) {}
  enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        this.active++
        fn().then(resolve).catch(reject).finally(() => {
          this.active--
          if (this.q.length) this.q.shift()!()
        })
      }
      this.active < this.max ? run() : this.q.push(run)
    })
  }
}
const fetchQ = new FetchQueue(4)

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTs(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function formatValue(v: number): string {
  if (v === null || v === undefined) return '—'
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'G'
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M'
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K'
  if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1)
  return v.toFixed(2)
}

function colSpanClass(w: number): string {
  if (w >= 18) return 'col-span-12 md:col-span-6 lg:col-span-4 xl:col-span-3'
  if (w >= 12) return 'col-span-12 md:col-span-6 lg:col-span-3 xl:col-span-2'
  if (w >= 8) return 'col-span-12 md:col-span-6 lg:col-span-2 xl:col-span-1'
  return 'col-span-12 md:col-span-6 lg:col-span-1'
}

/* ------------------------------------------------------------------ */
/*  PanelChart: Fetches data + renders a Recharts chart                */
/* ------------------------------------------------------------------ */

function PanelChart({ uid, panel, refreshTick }: { uid: string; panel: GrafanaPanel; refreshTick: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [series, setSeries] = useState<SeriesData[] | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error' | 'empty'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const hasLoaded = useRef(false)
  const isVisible = useRef(false)

  const fetchData = useCallback(() => {
    if (panel.targets.length === 0 || panel.type === 'text') { setStatus('empty'); return }
    const isRefresh = hasLoaded.current
    if (!isRefresh) setStatus('loading')
    fetchQ.enqueue(() =>
      api.post('/api/v1/grafana/query-panel', {
        dashboard_uid: uid,
        panel_id: panel.id,
        max_data_points: 60,
      }),
    )
    .then((resp) => {
      const s: SeriesData[] = resp.data.series || []
      setSeries(s)
      setStatus(s.length ? 'ok' : 'empty')
      hasLoaded.current = true
    })
    .catch((e) => {
      if (!hasLoaded.current) {
        setErrMsg(e?.response?.data?.detail || 'Query failed')
        setStatus('error')
      }
    })
  }, [uid, panel.id, panel.targets.length, panel.type])

  // Initial load via IntersectionObserver
  useEffect(() => {
    const el = ref.current
    if (!el || panel.targets.length === 0) { setStatus('empty'); return }
    if (panel.type === 'text') { setStatus('empty'); return }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          isVisible.current = true
          observer.disconnect()
          fetchData()
        }
      },
      { rootMargin: '300px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [fetchData])

  // Auto-refresh when refreshTick changes (only for visible+loaded panels)
  useEffect(() => {
    if (refreshTick > 0 && isVisible.current && hasLoaded.current) {
      fetchData()
    }
  }, [refreshTick, fetchData])

  const chartData = useMemo(() => {
    if (!series || !series.length) return []
    const allTs = new Set<number>()
    series.forEach(s => s.data.forEach(d => allTs.add(d.t)))
    const sortedTs = [...allTs].sort((a, b) => a - b)
    return sortedTs.map(t => {
      const row: any = { t }
      series.forEach((s, i) => {
        const point = s.data.find(d => d.t === t)
        row[`s${i}`] = point?.v ?? null
      })
      return row
    })
  }, [series])

  const ptype = panel.type

  return (
    <div ref={ref} className="w-full" style={{ minHeight: 120 }}>
      {status === 'idle' && (
        <div className="h-32 bg-gradient-to-br from-gray-50 to-gray-100 rounded animate-pulse" />
      )}
      {status === 'loading' && (
        <div className="h-32 flex items-center justify-center text-gray-300">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      )}
      {status === 'error' && (
        <div className="h-32 flex flex-col items-center justify-center text-gray-400 text-xs gap-1 px-3">
          <AlertTriangle className="w-5 h-5 text-gray-300" />
          <span className="text-center">{errMsg || 'Data unavailable'}</span>
        </div>
      )}
      {status === 'empty' && (
        <div className="h-20 flex items-center justify-center text-gray-300 text-xs">
          {panel.type === 'text' ? 'Text panel' : 'No data'}
        </div>
      )}
      {status === 'ok' && series && (
        <>
          {/* STAT / GAUGE: show latest value prominently */}
          {['stat', 'gauge', 'bargauge'].includes(ptype) ? (
            <StatDisplay series={series} panel={panel} />
          ) : ['barchart'].includes(ptype) ? (
            <div className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={chartData.slice(-20)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="t" tickFormatter={formatTs} tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={formatValue} width={45} />
                  <Tooltip labelFormatter={formatTs} formatter={(v: number) => formatValue(v)} />
                  {series.slice(0, 6).map((_, i) => (
                    <Bar key={i} dataKey={`s${i}`} fill={COLORS[i % COLORS.length]} radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            /* TIMESERIES / GRAPH: area chart */
            <div className="px-2 pb-2">
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={chartData}>
                  <defs>
                    {series.slice(0, 6).map((_, i) => (
                      <linearGradient key={i} id={`grad-${panel.id}-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.02} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="t" tickFormatter={formatTs} tick={{ fontSize: 10 }} stroke="#d1d5db" />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={formatValue} width={50} stroke="#d1d5db" />
                  <Tooltip
                    labelFormatter={formatTs}
                    formatter={(v: number) => formatValue(v)}
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb' }}
                  />
                  {series.length > 1 && series.length <= 6 && (
                    <Legend
                      formatter={(_, entry: any) => {
                        const idx = parseInt(entry.dataKey?.replace('s', '') || '0')
                        const s = series[idx]
                        return <span className="text-[10px] text-gray-500">{(s?.name || '').slice(0, 30)}</span>
                      }}
                      iconSize={8}
                      wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                    />
                  )}
                  {series.slice(0, 6).map((_, i) => (
                    <Area
                      key={i}
                      type="monotone"
                      dataKey={`s${i}`}
                      stroke={COLORS[i % COLORS.length]}
                      fill={`url(#grad-${panel.id}-${i})`}
                      strokeWidth={1.5}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  StatDisplay: Big number for stat/gauge panels                      */
/* ------------------------------------------------------------------ */

function StatDisplay({ series, panel }: { series: SeriesData[]; panel: GrafanaPanel }) {
  const thresholds = panel.thresholds?.steps || []

  return (
    <div className="flex flex-wrap items-center justify-center gap-4 py-4 px-3">
      {series.slice(0, 4).map((s, i) => {
        const lastVal = s.data.length ? s.data[s.data.length - 1].v : null
        let color = '#3b82f6'
        if (thresholds.length && lastVal !== null) {
          for (const step of thresholds) {
            if (step.value === null || lastVal >= step.value) {
              color = step.color || color
            }
          }
        }
        return (
          <div key={i} className="text-center min-w-[80px]">
            <div className="text-2xl font-bold" style={{ color }}>
              {lastVal !== null ? formatValue(lastVal) : '—'}
            </div>
            <div className="text-[10px] text-gray-400 truncate max-w-[120px]">{s.name}</div>
          </div>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  PanelCard                                                          */
/* ------------------------------------------------------------------ */

function PanelCard({ panel, uid, grafanaUrl, refreshTick }: { panel: GrafanaPanel; uid: string; grafanaUrl: string; refreshTick: number }) {
  const [showQueries, setShowQueries] = useState(false)
  const meta = PANEL_META[panel.type] || { icon: BarChart3, color: '#6b7280', label: panel.type }
  const Icon = meta.icon
  const panelUrl = `${grafanaUrl}/d/${uid}?viewPanel=${panel.id}`

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50/50">
        <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}15` }}>
          <Icon className="w-3 h-3" style={{ color: meta.color }} />
        </div>
        <h4 className="text-xs font-semibold text-gray-800 truncate flex-1">{panel.title || 'Untitled'}</h4>
        {panel.alert && (
          <span className="text-[9px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-full shrink-0">ALERT</span>
        )}
        <a
          href={panelUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-0.5 rounded text-gray-300 hover:text-blue-600 transition-colors shrink-0"
          title="Open in Grafana"
        >
          <Maximize2 className="w-3 h-3" />
        </a>
      </div>

      {/* Chart area */}
      <div className="flex-1 min-h-0">
        <PanelChart uid={uid} panel={panel} refreshTick={refreshTick} />
      </div>

      {/* Queries toggle */}
      {panel.targets.length > 0 && panel.type !== 'text' && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowQueries(!showQueries)}
            className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Code2 className="w-3 h-3" />
            {panel.targets.length} quer{panel.targets.length === 1 ? 'y' : 'ies'}
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showQueries ? 'rotate-180' : ''}`} />
          </button>
          {showQueries && (
            <div className="px-3 pb-2 space-y-1">
              {panel.targets.map((t, i) => (
                <div key={i} className="bg-gray-50 rounded px-2 py-1 flex items-start gap-1.5">
                  <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded mt-0.5 shrink-0">{t.refId}</span>
                  <code className="text-[10px] text-gray-500 font-mono break-all leading-relaxed">{t.expr || '—'}</code>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  SectionGrid: renders panels in a responsive grid                   */
/* ------------------------------------------------------------------ */

function SectionGrid({ panels, uid, grafanaUrl, refreshTick }: { panels: GrafanaPanel[]; uid: string; grafanaUrl: string; refreshTick: number }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      {panels.map((panel) => {
        const w = panel.gridPos?.w || 12
        let span = 'col-span-12'
        if (w <= 6) span = 'col-span-12 sm:col-span-6 lg:col-span-3'
        else if (w <= 8) span = 'col-span-12 sm:col-span-6 lg:col-span-4'
        else if (w <= 12) span = 'col-span-12 sm:col-span-6 lg:col-span-6'
        else if (w <= 16) span = 'col-span-12 lg:col-span-8'
        else span = 'col-span-12'

        return (
          <div key={panel.id} className={span}>
            <PanelCard panel={panel} uid={uid} grafanaUrl={grafanaUrl} refreshTick={refreshTick} />
          </div>
        )
      })}
    </div>
  )
}

/* ================================================================== */
/*  Main Page                                                          */
/* ================================================================== */

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '10s', value: 10 },
  { label: '30s', value: 30 },
  { label: '1m', value: 60 },
  { label: '5m', value: 300 },
]

export default function GrafanaDashboardDetailPage() {
  const { uid } = useParams<{ uid: string }>()
  const [dashboard, setDashboard] = useState<DashboardDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set())
  const [refreshTick, setRefreshTick] = useState(0)
  const [refreshInterval, setRefreshInterval] = useState(30)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())
  const [countdown, setCountdown] = useState(30)

  useEffect(() => {
    if (!uid) return
    setLoading(true)
    api.get<DashboardDetail>(`/api/v1/grafana/dashboards/${uid}`)
      .then((r) => setDashboard(r.data))
      .catch((err) => setError(err?.response?.data?.detail || 'Failed to load dashboard'))
      .finally(() => setLoading(false))
  }, [uid])

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return
    setCountdown(refreshInterval)
    const id = setInterval(() => {
      setRefreshTick((t) => t + 1)
      setLastRefresh(new Date())
      setCountdown(refreshInterval)
    }, refreshInterval * 1000)
    return () => clearInterval(id)
  }, [refreshInterval])

  // Countdown timer
  useEffect(() => {
    if (refreshInterval <= 0) return
    const id = setInterval(() => {
      setCountdown((c) => (c > 0 ? c - 1 : refreshInterval))
    }, 1000)
    return () => clearInterval(id)
  }, [refreshInterval])

  const manualRefresh = useCallback(() => {
    setRefreshTick((t) => t + 1)
    setLastRefresh(new Date())
    setCountdown(refreshInterval)
  }, [refreshInterval])

  const toggleSection = useCallback((idx: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      next.has(idx) ? next.delete(idx) : next.add(idx)
      return next
    })
  }, [])

  const runAnalysis = async () => {
    if (!uid) return
    setAnalyzing(true)
    try {
      const resp = await api.post<AnalysisResult>('/api/v1/grafana/analyze', { dashboard_uid: uid })
      setAnalysis(resp.data)
    } catch {
      setAnalysis({
        dashboard_title: dashboard?.title || '',
        summary: 'Analysis unavailable.',
        insights: [{ severity: 'warning', title: 'Analysis failed', description: 'Could not reach the AI service.', recommendation: 'Try again later.' }],
        ai_powered: false,
      })
    } finally {
      setAnalyzing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-gray-500 text-sm">Loading dashboard from Grafana...</span>
      </div>
    )
  }

  if (error || !dashboard) {
    return (
      <div className="text-center py-24">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Failed to load dashboard</h3>
        <p className="text-sm text-gray-500 mb-6">{error}</p>
        <Link to="/dashboards/grafana" className="text-blue-600 hover:underline text-sm">Back to Grafana Dashboards</Link>
      </div>
    )
  }

  const sections = dashboard.sections?.length
    ? dashboard.sections
    : [{ title: '', collapsed: false, panels: dashboard.panels }]
  const totalPanels = dashboard.panels.filter((p) => p.type !== 'row').length

  return (
    <div className="pb-8 max-w-[1600px] mx-auto">
      {/* Breadcrumb */}
      <Link to="/dashboards/grafana" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-blue-600 mb-4">
        <ArrowLeft className="w-4 h-4" /> Grafana Dashboards
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900">{dashboard.title}</h1>
            {dashboard.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{dashboard.description}</p>}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1"><Folder className="w-3 h-3" />{dashboard.folder}</span>
              <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{totalPanels} panels</span>
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" />{sections.length} section{sections.length !== 1 ? 's' : ''}</span>
              {dashboard.updated && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Updated {new Date(dashboard.updated).toLocaleDateString()}</span>
              )}
            </div>
            {dashboard.tags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <Tag className="w-3 h-3 text-gray-300" />
                {dashboard.tags.map((t) => (
                  <span key={t} className="px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700">{t}</span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
              {analyzing ? 'Analyzing...' : 'AI Analysis'}
            </button>
            <a
              href={`${dashboard.grafana_url}/d/${dashboard.uid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" /> Open in Grafana
            </a>
          </div>
        </div>

        {/* Auto-refresh controls */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={manualRefresh}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
            title="Refresh now"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>

          <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
            {REFRESH_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setRefreshInterval(opt.value); setCountdown(opt.value) }}
                className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  refreshInterval === opt.value
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {refreshInterval > 0 && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>Live</span>
              </div>
              <span className="text-gray-300">|</span>
              <span>Next refresh in {countdown}s</span>
            </div>
          )}

          {refreshInterval === 0 && (
            <div className="flex items-center gap-1.5 text-xs text-gray-400">
              <Pause className="w-3 h-3" />
              <span>Auto-refresh paused</span>
            </div>
          )}

          <span className="ml-auto text-[10px] text-gray-400">
            Last: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* AI Analysis */}
      {analysis && (
        <div className="bg-white rounded-xl border border-purple-200 mb-5 overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple-600 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm text-gray-900">AI Analysis</h2>
              <p className="text-xs text-gray-600 truncate">{analysis.summary}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${analysis.ai_powered ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
              {analysis.ai_powered ? 'AI-Powered' : 'Rule-based'}
            </span>
          </div>
          <div className="p-4 space-y-2">
            {analysis.insights.map((insight, i) => {
              const c = SEV[insight.severity] || SEV.info
              const SevIcon = c.icon
              return (
                <div key={i} className={`${c.bg} border rounded-lg p-3`}>
                  <div className="flex items-start gap-2.5">
                    <span className={`${c.badge} text-white w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                      <SevIcon className="w-3 h-3" />
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-semibold ${c.text}`}>{insight.title}</h4>
                      <p className="text-xs text-gray-600 mt-0.5">{insight.description}</p>
                      <div className="flex items-start gap-1.5 mt-1.5 text-xs text-gray-600">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0 mt-0.5" />
                        <span>{insight.recommendation}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Sections & Panels */}
      <div className="space-y-4">
        {sections.map((section, sIdx) => {
          const isCollapsed = collapsedSections.has(sIdx)
          return (
            <div key={sIdx}>
              {section.title && (
                <button
                  onClick={() => toggleSection(sIdx)}
                  className="flex items-center gap-2 w-full text-left py-2 px-1 mb-2 group"
                >
                  <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? '' : 'rotate-90'}`} />
                  <span className="text-sm font-semibold text-gray-700 group-hover:text-blue-600 transition-colors">{section.title}</span>
                  <span className="text-xs text-gray-400 ml-1">{section.panels.length} panels</span>
                  <div className="flex-1 border-b border-gray-200 ml-3" />
                </button>
              )}
              {!isCollapsed && (
                <SectionGrid panels={section.panels} uid={dashboard.uid} grafanaUrl={dashboard.grafana_url} refreshTick={refreshTick} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
