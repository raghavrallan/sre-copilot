export interface MonitorLatestResult {
  timestamp: string
  success: boolean
  response_time_ms?: number
  status_code?: number
}

export interface MonitorApi {
  monitor_id: string
  name: string
  type: string
  url: string
  enabled: boolean
  latest_result?: MonitorLatestResult
}

export interface SyntheticsResultApi {
  timestamp: string
  success: boolean
  response_time_ms?: number
  status_code?: number
}

export interface SyntheticsResultsResponse {
  items: SyntheticsResultApi[]
}

export type MonitorUiType = 'ping' | 'api'

export type MonitorUiStatus = 'passing' | 'failing'

export interface SyntheticsMonitor {
  id: string
  name: string
  type: MonitorUiType
  url: string
  status: MonitorUiStatus
  lastCheck: string
}

export interface SyntheticsResult {
  timestamp: string
  status: 'pass' | 'fail'
  responseTime: number
  statusCode: number
}

export interface CreateSyntheticsMonitorPayload {
  project_id: string
  name: string
  type: 'ping' | 'api_test'
  url: string
  frequency_seconds: number
  assertions: string[]
  enabled: boolean
}
