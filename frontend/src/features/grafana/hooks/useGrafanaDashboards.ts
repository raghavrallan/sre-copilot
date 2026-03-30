import { useState, useEffect, useCallback } from 'react'
import { fetchGrafanaDashboards } from '../api'
import type { GrafanaResponse } from '../types'

function getErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const r = (err as { response?: { data?: { detail?: string } } }).response
    if (r?.data?.detail) return r.data.detail
  }
  if (err instanceof Error && err.message) return err.message
  return 'Failed to load Grafana dashboards'
}

export function useGrafanaDashboards() {
  const [data, setData] = useState<GrafanaResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchGrafanaDashboards()
      setData(result)
    } catch (err: unknown) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { data, loading, error, refetch }
}
