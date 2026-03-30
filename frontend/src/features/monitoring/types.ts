export interface VitalMetric {
  avg: number
  count: number
}

export interface WebVitals {
  LCP?: VitalMetric
  FID?: VitalMetric
  CLS?: VitalMetric
  FCP?: VitalMetric
  TTFB?: VitalMetric
}

export interface BrowserOverviewResponse {
  web_vitals: WebVitals
  js_errors_total: number
  page_loads_total: number
  ajax_calls_total: number
  total_events: number
}

export interface BrowserPageLoad {
  url: string
  timestamp: string
  dom_content_loaded?: number
  load_complete?: number
  first_paint?: number
  first_contentful_paint?: number
}

export interface BrowserJsError {
  url: string
  timestamp: string
  message: string
  filename?: string
  lineno?: number
  colno?: number
  type?: string
}

export interface BrowserAjaxCall {
  page_url: string
  timestamp: string
  url: string
  method: string
  duration_ms: number
  status: number
  success: boolean
}

export const WEB_VITAL_NAMES: (keyof WebVitals)[] = ['LCP', 'FID', 'CLS', 'FCP', 'TTFB']
