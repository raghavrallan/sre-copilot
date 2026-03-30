import { useState, useEffect, useCallback } from 'react'
import * as monitoringApi from '../api'
import type {
  BrowserAjaxCall,
  BrowserJsError,
  BrowserOverviewResponse,
  BrowserPageLoad,
} from '../types'

export function useMonitoring() {
  const [overview, setOverview] = useState<BrowserOverviewResponse | null>(null)
  const [pageLoads, setPageLoads] = useState<BrowserPageLoad[]>([])
  const [errors, setErrors] = useState<BrowserJsError[]>([])
  const [ajaxCalls, setAjaxCalls] = useState<BrowserAjaxCall[]>([])

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [pageLoadsLoading, setPageLoadsLoading] = useState(true)
  const [pageLoadsError, setPageLoadsError] = useState<string | null>(null)
  const [errorsLoading, setErrorsLoading] = useState(true)
  const [errorsError, setErrorsError] = useState<string | null>(null)
  const [ajaxLoading, setAjaxLoading] = useState(true)
  const [ajaxError, setAjaxError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    setOverviewLoading(true)
    setOverviewError(null)
    try {
      const data = await monitoringApi.fetchBrowserOverview()
      setOverview(data)
    } catch (err) {
      setOverviewError(err instanceof Error ? err.message : 'Failed to load overview')
      setOverview(null)
    } finally {
      setOverviewLoading(false)
    }
  }, [])

  const fetchPageLoads = useCallback(async () => {
    setPageLoadsLoading(true)
    setPageLoadsError(null)
    try {
      const data = await monitoringApi.fetchBrowserPageLoads()
      setPageLoads(data)
    } catch (err) {
      setPageLoadsError(err instanceof Error ? err.message : 'Failed to load page loads')
      setPageLoads([])
    } finally {
      setPageLoadsLoading(false)
    }
  }, [])

  const fetchErrors = useCallback(async () => {
    setErrorsLoading(true)
    setErrorsError(null)
    try {
      const data = await monitoringApi.fetchBrowserErrors()
      setErrors(data)
    } catch (err) {
      setErrorsError(err instanceof Error ? err.message : 'Failed to load errors')
      setErrors([])
    } finally {
      setErrorsLoading(false)
    }
  }, [])

  const fetchAjax = useCallback(async () => {
    setAjaxLoading(true)
    setAjaxError(null)
    try {
      const data = await monitoringApi.fetchBrowserAjax()
      setAjaxCalls(data)
    } catch (err) {
      setAjaxError(err instanceof Error ? err.message : 'Failed to load AJAX calls')
      setAjaxCalls([])
    } finally {
      setAjaxLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    fetchPageLoads()
  }, [fetchPageLoads])

  useEffect(() => {
    fetchErrors()
  }, [fetchErrors])

  useEffect(() => {
    fetchAjax()
  }, [fetchAjax])

  const hasAnyError = overviewError || pageLoadsError || errorsError || ajaxError

  return {
    overview,
    pageLoads,
    errors,
    ajaxCalls,
    overviewLoading,
    overviewError,
    pageLoadsLoading,
    pageLoadsError,
    errorsLoading,
    errorsError,
    ajaxLoading,
    ajaxError,
    hasAnyError,
    fetchOverview,
    fetchPageLoads,
    fetchErrors,
    fetchAjax,
  }
}
