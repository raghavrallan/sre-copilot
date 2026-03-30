import { useEffect, useState } from 'react'
import { useAuthStore } from '../../../stores/auth-store'
import {
  fetchActiveAlerts,
  fetchChannels,
  fetchConditions,
  fetchGrafanaAlertRules,
  fetchMutingRules,
  fetchPolicies,
} from '../api'
import type {
  ActiveAlert,
  Channel,
  Condition,
  GrafanaRule,
  MutingRule,
  Policy,
  Tab,
} from '../types'

const initialLoading: Record<Tab, boolean> = {
  active: false,
  grafana: false,
  conditions: false,
  policies: false,
  channels: false,
  muting: false,
}

const initialError: Record<Tab, string | null> = {
  active: null,
  grafana: null,
  conditions: null,
  policies: null,
  channels: null,
  muting: null,
}

export function useAlerts() {
  const { currentProject } = useAuthStore()
  const [activeTab, setActiveTab] = useState<Tab>('active')

  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([])
  const [conditions, setConditions] = useState<Condition[]>([])
  const [policies, setPolicies] = useState<Policy[]>([])
  const [channels, setChannels] = useState<Channel[]>([])
  const [mutingRules, setMutingRules] = useState<MutingRule[]>([])
  const [grafanaRules, setGrafanaRules] = useState<GrafanaRule[]>([])
  const [grafanaUrl, setGrafanaUrl] = useState('')

  const [loading, setLoading] = useState<Record<Tab, boolean>>(initialLoading)
  const [error, setError] = useState<Record<Tab, string | null>>(initialError)

  useEffect(() => {
    if (activeTab !== 'active' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, active: true }))
    setError((e) => ({ ...e, active: null }))
    fetchActiveAlerts(currentProject.id)
      .then((items) => {
        if (!cancelled) setActiveAlerts(items)
      })
      .catch((err: { response?: { data?: { detail?: string } }; message?: string }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            active: err.response?.data?.detail ?? err.message ?? 'Failed to load active alerts',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, active: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'grafana') return
    let cancelled = false
    setLoading((l) => ({ ...l, grafana: true }))
    setError((e) => ({ ...e, grafana: null }))
    fetchGrafanaAlertRules()
      .then((res) => {
        if (!cancelled) {
          setGrafanaRules(res.rules)
          setGrafanaUrl(res.grafana_url ?? '')
        }
      })
      .catch((err: { response?: { data?: { detail?: string } } }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            grafana: err.response?.data?.detail ?? 'Failed to load Grafana alert rules',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, grafana: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab])

  useEffect(() => {
    if (activeTab !== 'conditions' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, conditions: true }))
    setError((e) => ({ ...e, conditions: null }))
    fetchConditions(currentProject.id)
      .then((items) => {
        if (!cancelled) setConditions(items)
      })
      .catch((err: { response?: { data?: { detail?: string } }; message?: string }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            conditions: err.response?.data?.detail ?? err.message ?? 'Failed to load conditions',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, conditions: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'policies' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, policies: true }))
    setError((e) => ({ ...e, policies: null }))
    fetchPolicies(currentProject.id)
      .then((items) => {
        if (!cancelled) setPolicies(items)
      })
      .catch((err: { response?: { data?: { detail?: string } }; message?: string }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            policies: err.response?.data?.detail ?? err.message ?? 'Failed to load policies',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, policies: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'channels' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, channels: true }))
    setError((e) => ({ ...e, channels: null }))
    fetchChannels(currentProject.id)
      .then((items) => {
        if (!cancelled) setChannels(items)
      })
      .catch((err: { response?: { data?: { detail?: string } }; message?: string }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            channels: err.response?.data?.detail ?? err.message ?? 'Failed to load channels',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, channels: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, currentProject?.id])

  useEffect(() => {
    if (activeTab !== 'muting' || !currentProject?.id) return
    let cancelled = false
    setLoading((l) => ({ ...l, muting: true }))
    setError((e) => ({ ...e, muting: null }))
    fetchMutingRules(currentProject.id)
      .then((items) => {
        if (!cancelled) setMutingRules(items)
      })
      .catch((err: { response?: { data?: { detail?: string } }; message?: string }) => {
        if (!cancelled)
          setError((e) => ({
            ...e,
            muting: err.response?.data?.detail ?? err.message ?? 'Failed to load muting rules',
          }))
      })
      .finally(() => {
        if (!cancelled) setLoading((l) => ({ ...l, muting: false }))
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, currentProject?.id])

  return {
    currentProject,
    activeTab,
    setActiveTab,
    loading,
    error,
    activeAlerts,
    conditions,
    policies,
    channels,
    mutingRules,
    grafanaRules,
    grafanaUrl,
  }
}
