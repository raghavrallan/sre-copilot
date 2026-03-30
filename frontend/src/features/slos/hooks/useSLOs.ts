import { useState, useEffect, useCallback } from 'react'
import * as slosApi from '../api'
import {
  DEFAULT_SLO_SERVICES,
  defaultCreateSLOForm,
  mapApiToSLO,
  type CreateSLOFormState,
  type GrafanaDashboardListItem,
  type GrafanaDashboardPanel,
  type SLO,
  type SloLiveComplianceResult,
} from '../types'

function parseApiError(err: unknown, fallback: string): string {
  const msg =
    err && typeof err === 'object' && 'response' in err
      ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
      : fallback
  return typeof msg === 'string' ? msg : fallback
}

export function useSLOs() {
  const [slos, setSlos] = useState<SLO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createSubmitting, setCreateSubmitting] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createForm, setCreateForm] = useState<CreateSLOFormState>(() =>
    defaultCreateSLOForm(DEFAULT_SLO_SERVICES[0])
  )
  const [liveCompliance, setLiveCompliance] = useState<Record<string, SloLiveComplianceResult>>({})
  const [grafanaDashboards, setGrafanaDashboards] = useState<GrafanaDashboardListItem[]>([])
  const [showPanelPicker, setShowPanelPicker] = useState(false)
  const [selectedDashUid, setSelectedDashUid] = useState('')
  const [dashPanels, setDashPanels] = useState<GrafanaDashboardPanel[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const raw = await slosApi.fetchSlos()
        if (!cancelled) setSlos((raw || []).map(mapApiToSLO))
      } catch (err: unknown) {
        if (!cancelled) setError(parseApiError(err, 'Failed to load SLOs'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const raw = await slosApi.fetchSlos()
      setSlos((raw || []).map(mapApiToSLO))
    } catch (err: unknown) {
      setError(parseApiError(err, 'Failed to load SLOs'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (slos.length === 0) return
    slos.forEach(async (slo) => {
      const promqlMatch = slo.description?.match(/\[promql:(.+?)\]/)
      if (!promqlMatch) return
      try {
        const data = await slosApi.postGrafanaSloQuery({
          expr: promqlMatch[1],
          target_percentage: slo.target,
          time_window_days: parseInt(slo.timeWindow, 10) || 30,
        })
        setLiveCompliance((prev) => ({ ...prev, [slo.id]: data }))
      } catch {
        /* ignore */
      }
    })
  }, [slos])

  useEffect(() => {
    slosApi
      .fetchGrafanaDashboards()
      .then((resp) => setGrafanaDashboards((resp.dashboards || []).filter((d) => d.uid)))
      .catch(() => {})
  }, [])

  const loadDashboardPanels = useCallback(async (uid: string) => {
    setSelectedDashUid(uid)
    try {
      const resp = await slosApi.fetchGrafanaDashboard(uid)
      const panels = resp.panels || []
      setDashPanels(
        panels.filter((p) => p.targets?.length && p.type !== 'row' && p.type !== 'text')
      )
    } catch {
      setDashPanels([])
    }
  }, [])

  const pickPanelExpr = useCallback((panel: GrafanaDashboardPanel) => {
    const expr = panel.targets?.[0]?.expr || ''
    setCreateForm((f) => ({ ...f, promql_expr: expr }))
    setShowPanelPicker(false)
  }, [])

  const handleCreate = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateSubmitting(true)
    setCreateError(null)
    try {
      const payload = { ...createForm }
      if (payload.promql_expr) {
        payload.description = `${payload.description || ''} [promql:${payload.promql_expr}]`.trim()
      }
      const { promql_expr: _, ...apiPayload } = payload
      const data = await slosApi.createSlo(apiPayload)
      setSlos((prev) => [mapApiToSLO(data), ...prev])
      setShowCreateModal(false)
      setCreateForm(defaultCreateSLOForm(DEFAULT_SLO_SERVICES[0]))
    } catch (err: unknown) {
      setCreateError(parseApiError(err, 'Failed to create SLO'))
    } finally {
      setCreateSubmitting(false)
    }
  }, [createForm])

  return {
    slos,
    loading,
    error,
    refetch,
    expandedId,
    setExpandedId,
    showCreateModal,
    setShowCreateModal,
    createSubmitting,
    createError,
    createForm,
    setCreateForm,
    handleCreate,
    liveCompliance,
    grafanaDashboards,
    showPanelPicker,
    setShowPanelPicker,
    selectedDashUid,
    dashPanels,
    loadDashboardPanels,
    pickPanelExpr,
    defaultServices: DEFAULT_SLO_SERVICES,
  }
}
