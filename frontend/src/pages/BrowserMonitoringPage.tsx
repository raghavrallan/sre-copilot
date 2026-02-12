import { useState, useEffect } from 'react'
import { Monitor, Loader2 } from 'lucide-react'
import api from '../services/api'

interface VitalMetric {
  avg: number
  count: number
}

interface WebVitals {
  LCP?: VitalMetric
  FID?: VitalMetric
  CLS?: VitalMetric
  FCP?: VitalMetric
  TTFB?: VitalMetric
}

interface OverviewResponse {
  web_vitals: WebVitals
  js_errors_total: number
  page_loads_total: number
  ajax_calls_total: number
  total_events: number
}

interface PageLoad {
  url: string
  timestamp: string
  dom_content_loaded?: number
  load_complete?: number
  first_paint?: number
  first_contentful_paint?: number
}

interface BrowserError {
  url: string
  timestamp: string
  message: string
  filename?: string
  lineno?: number
  colno?: number
  type?: string
}

interface AjaxCall {
  page_url: string
  timestamp: string
  url: string
  method: string
  duration_ms: number
  status: number
  success: boolean
}

const VITAL_NAMES: (keyof WebVitals)[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB']

function formatVitalValue(name: string, avg: number): string {
  if (name === 'LCP' || name === 'FCP') return `${avg.toFixed(2)}s`
  if (name === 'FID') return `${avg.toFixed(0)}ms`
  if (name === 'CLS') return avg.toFixed(3)
  if (name === 'TTFB') return `${avg.toFixed(0)}ms`
  return String(avg)
}

function formatTimestamp(ts: string): string {
  try {
    const d = new Date(ts)
    return d.toLocaleString()
  } catch {
    return ts
  }
}

export default function BrowserMonitoringPage() {
  const [overview, setOverview] = useState<OverviewResponse | null>(null)
  const [pageLoads, setPageLoads] = useState<PageLoad[]>([])
  const [errors, setErrors] = useState<BrowserError[]>([])
  const [ajaxCalls, setAjaxCalls] = useState<AjaxCall[]>([])

  const [overviewLoading, setOverviewLoading] = useState(true)
  const [overviewError, setOverviewError] = useState<string | null>(null)
  const [pageLoadsLoading, setPageLoadsLoading] = useState(true)
  const [pageLoadsError, setPageLoadsError] = useState<string | null>(null)
  const [errorsLoading, setErrorsLoading] = useState(true)
  const [errorsError, setErrorsError] = useState<string | null>(null)
  const [ajaxLoading, setAjaxLoading] = useState(true)
  const [ajaxError, setAjaxError] = useState<string | null>(null)

  useEffect(() => {
    const fetchOverview = async () => {
      setOverviewLoading(true)
      setOverviewError(null)
      try {
        const { data } = await api.get<OverviewResponse>('/api/v1/browser/overview')
        setOverview(data)
      } catch (err) {
        setOverviewError(err instanceof Error ? err.message : 'Failed to load overview')
        setOverview(null)
      } finally {
        setOverviewLoading(false)
      }
    }
    fetchOverview()
  }, [])

  useEffect(() => {
    const fetchPageLoads = async () => {
      setPageLoadsLoading(true)
      setPageLoadsError(null)
      try {
        const { data } = await api.get<PageLoad[]>('/api/v1/browser/page-loads')
        setPageLoads(Array.isArray(data) ? data : [])
      } catch (err) {
        setPageLoadsError(err instanceof Error ? err.message : 'Failed to load page loads')
        setPageLoads([])
      } finally {
        setPageLoadsLoading(false)
      }
    }
    fetchPageLoads()
  }, [])

  useEffect(() => {
    const fetchErrors = async () => {
      setErrorsLoading(true)
      setErrorsError(null)
      try {
        const { data } = await api.get<BrowserError[]>('/api/v1/browser/errors')
        setErrors(Array.isArray(data) ? data : [])
      } catch (err) {
        setErrorsError(err instanceof Error ? err.message : 'Failed to load errors')
        setErrors([])
      } finally {
        setErrorsLoading(false)
      }
    }
    fetchErrors()
  }, [])

  useEffect(() => {
    const fetchAjax = async () => {
      setAjaxLoading(true)
      setAjaxError(null)
      try {
        const { data } = await api.get<AjaxCall[]>('/api/v1/browser/ajax')
        setAjaxCalls(Array.isArray(data) ? data : [])
      } catch (err) {
        setAjaxError(err instanceof Error ? err.message : 'Failed to load AJAX calls')
        setAjaxCalls([])
      } finally {
        setAjaxLoading(false)
      }
    }
    fetchAjax()
  }, [])

  const hasAnyError = overviewError || pageLoadsError || errorsError || ajaxError

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <Monitor className="w-8 h-8 text-blue-400" />
          Browser Monitoring
        </h1>
        <p className="text-sm text-gray-400 mt-2">Web Vitals and real user monitoring</p>
      </div>

      {hasAnyError && (
        <div className="mb-6 space-y-2">
          {overviewError && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">Overview: {overviewError}</div>
          )}
          {pageLoadsError && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">Page loads: {pageLoadsError}</div>
          )}
          {errorsError && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">Errors: {errorsError}</div>
          )}
          {ajaxError && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-400">AJAX: {ajaxError}</div>
          )}
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-white mb-4">Web Vitals Overview</h2>
        {overviewLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : overviewError ? (
          <p className="text-gray-400 text-sm">Could not load web vitals.</p>
        ) : overview?.web_vitals ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {VITAL_NAMES.map((name) => {
              const v = overview.web_vitals[name]
              if (!v) return null
              return (
                <div key={name} className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
                  <span className="text-sm text-gray-400">{name}</span>
                  <p className="text-2xl font-bold text-white mt-1">{formatVitalValue(name, v.avg)}</p>
                  <p className="text-sm text-gray-500">{v.count} samples</p>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">No web vitals data available.</p>
        )}
      </div>

      {overview && !overviewLoading && !overviewError && (
        <div className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <p className="text-sm text-gray-400">Page Loads</p>
            <p className="text-2xl font-bold text-white">{overview.page_loads_total ?? 0}</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <p className="text-sm text-gray-400">JS Errors</p>
            <p className="text-2xl font-bold text-white">{overview.js_errors_total ?? 0}</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <p className="text-sm text-gray-400">AJAX Calls</p>
            <p className="text-2xl font-bold text-white">{overview.ajax_calls_total ?? 0}</p>
          </div>
          <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-4">
            <p className="text-sm text-gray-400">Total Events</p>
            <p className="text-2xl font-bold text-white">{overview.total_events ?? 0}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Page Loads</h3>
          {pageLoadsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : pageLoadsError ? (
            <p className="text-gray-400 text-sm">Could not load page loads.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="px-4 py-2 text-left text-gray-400 font-medium">URL</th>
                    <th className="px-4 py-2 text-left text-gray-400 font-medium">Time</th>
                    <th className="px-4 py-2 text-left text-gray-400 font-medium">DOM Ready</th>
                    <th className="px-4 py-2 text-left text-gray-400 font-medium">Load</th>
                    <th className="px-4 py-2 text-left text-gray-400 font-medium">FCP</th>
                  </tr>
                </thead>
                <tbody>
                  {pageLoads.map((p, i) => (
                    <tr key={i} className="border-b border-gray-600/50 last:border-0">
                      <td className="px-4 py-2 text-white font-mono">{p.url}</td>
                      <td className="px-4 py-2 text-gray-300">{formatTimestamp(p.timestamp)}</td>
                      <td className="px-4 py-2 text-gray-300">{p.dom_content_loaded != null ? `${p.dom_content_loaded}ms` : '—'}</td>
                      <td className="px-4 py-2 text-gray-300">{p.load_complete != null ? `${p.load_complete}ms` : '—'}</td>
                      <td className="px-4 py-2 text-gray-300">{p.first_contentful_paint != null ? `${p.first_contentful_paint}ms` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {pageLoads.length === 0 && <p className="text-gray-400 text-sm py-4">No page loads recorded.</p>}
            </div>
          )}
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">JS Errors</h3>
          {errorsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
            </div>
          ) : errorsError ? (
            <p className="text-gray-400 text-sm">Could not load errors.</p>
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {errors.map((e, i) => (
                <div key={i} className="p-3 bg-gray-700/50 rounded-lg">
                  <p className="text-white text-sm mb-1">{e.message}</p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    <span>URL: {e.url}</span>
                    <span>{formatTimestamp(e.timestamp)}</span>
                    {e.filename && <span>File: {e.filename}</span>}
                    {e.lineno != null && <span>Line: {e.lineno}</span>}
                  </div>
                </div>
              ))}
              {errors.length === 0 && <p className="text-gray-400 text-sm">No JS errors recorded.</p>}
            </div>
          )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">AJAX Calls</h3>
        {ajaxLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : ajaxError ? (
          <p className="text-gray-400 text-sm">Could not load AJAX calls.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-600">
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Page</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">URL</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Method</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Duration</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Status</th>
                  <th className="px-4 py-2 text-left text-gray-400 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {ajaxCalls.map((a, i) => (
                  <tr key={i} className="border-b border-gray-600/50 last:border-0">
                    <td className="px-4 py-2 text-white font-mono">{a.page_url}</td>
                    <td className="px-4 py-2 text-gray-300 font-mono truncate max-w-[200px]">{a.url}</td>
                    <td className="px-4 py-2 text-gray-300">{a.method}</td>
                    <td className="px-4 py-2 text-gray-300">{a.duration_ms}ms</td>
                    <td className="px-4 py-2">
                      <span className={a.success ? 'text-green-400' : 'text-red-400'}>{a.status}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{formatTimestamp(a.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ajaxCalls.length === 0 && <p className="text-gray-400 text-sm py-4">No AJAX calls recorded.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
