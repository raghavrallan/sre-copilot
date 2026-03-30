import { useState, useEffect, useCallback } from 'react'
import { useWebSocketEvent } from '../../../hooks/useWebSocketEvent'
import { useAuthStore } from '../../../stores/auth-store'
import * as incidentsApi from '../api'
import type { Incident, Hypothesis, ActivityItem } from '../types'
import toast from 'react-hot-toast'

type TabId = 'overview' | 'prometheus' | 'pipeline' | 'costs' | 'activity'

export function useIncidentDetail(id: string | undefined) {
  const { user, currentProject } = useAuthStore()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [submitting, setSubmitting] = useState(false)

  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [inc, hyps, acts] = await Promise.all([
        incidentsApi.getIncident(id, currentProject?.id),
        incidentsApi.getHypotheses(id, currentProject?.id),
        incidentsApi.getActivities(id, currentProject?.id),
      ])
      setIncident(inc)
      setHypotheses(hyps)
      setActivities(acts)
    } catch (error) {
      console.error('Failed to fetch incident details:', error)
    } finally {
      setLoading(false)
    }
  }, [id, currentProject?.id])

  useEffect(() => { fetchData() }, [fetchData])

  useWebSocketEvent<Incident>('incident.updated', (updated) => {
    if (updated.id === id) setIncident(updated)
  }, [id])

  useWebSocketEvent<Hypothesis>('hypothesis.generated', (newHyp) => {
    if (newHyp.incident_id === id) {
      setHypotheses((prev) => {
        const exists = prev.some((h) => h.id === newHyp.id)
        if (exists) return prev.map((h) => (h.id === newHyp.id ? newHyp : h))
        return [...prev, newHyp].sort((a, b) => a.rank - b.rank)
      })
    }
  }, [id])

  const changeState = useCallback(async (state: string, comment?: string) => {
    if (!id || submitting) return
    setSubmitting(true)
    try {
      await incidentsApi.updateState(id, currentProject?.id, {
        state,
        comment: comment || null,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email,
      })
      toast.success(`Status changed to ${state}`)
      fetchData()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }, [id, currentProject?.id, user, submitting, fetchData])

  const changeSeverity = useCallback(async (severity: string, comment?: string) => {
    if (!id || submitting) return
    setSubmitting(true)
    try {
      await incidentsApi.updateSeverity(id, currentProject?.id, {
        severity,
        comment: comment || null,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email,
      })
      toast.success(`Severity changed to ${severity}`)
      fetchData()
    } catch {
      toast.error('Failed to update severity')
    } finally {
      setSubmitting(false)
    }
  }, [id, currentProject?.id, user, submitting, fetchData])

  const addComment = useCallback(async (text: string) => {
    if (!id) return
    setSubmitting(true)
    try {
      await incidentsApi.addComment(id, currentProject?.id, {
        content: text,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email,
      })
      toast.success('Comment added')
      fetchData()
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }, [id, currentProject?.id, user, fetchData])

  return {
    incident,
    hypotheses,
    activities,
    loading,
    activeTab,
    setActiveTab,
    submitting,
    changeState,
    changeSeverity,
    addComment,
  }
}
