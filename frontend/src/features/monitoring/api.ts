import api from '../../services/api'
import type {
  BrowserAjaxCall,
  BrowserJsError,
  BrowserOverviewResponse,
  BrowserPageLoad,
} from './types'

export async function fetchBrowserOverview(): Promise<BrowserOverviewResponse> {
  const { data } = await api.get<BrowserOverviewResponse>('/api/v1/browser/overview')
  return data
}

export async function fetchBrowserPageLoads(): Promise<BrowserPageLoad[]> {
  const { data } = await api.get<BrowserPageLoad[]>('/api/v1/browser/page-loads')
  return Array.isArray(data) ? data : []
}

export async function fetchBrowserErrors(): Promise<BrowserJsError[]> {
  const { data } = await api.get<BrowserJsError[]>('/api/v1/browser/errors')
  return Array.isArray(data) ? data : []
}

export async function fetchBrowserAjax(): Promise<BrowserAjaxCall[]> {
  const { data } = await api.get<BrowserAjaxCall[]>('/api/v1/browser/ajax')
  return Array.isArray(data) ? data : []
}
