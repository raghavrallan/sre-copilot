export interface SLOApi {
  slo_id: string
  name: string
  service_name: string
  sli_type: string
  target_percentage: number
  time_window_days: number
  description?: string
  current_compliance: number
  error_budget_remaining: number
  burn_rate: number
}

export type SLOStatus = 'meeting' | 'at_risk' | 'breached'

export interface SLO {
  id: string
  name: string
  service: string
  target: number
  current: number
  errorBudgetRemaining: number
  burnRate: number
  timeWindow: string
  status: SLOStatus
  description?: string
}

export interface CreateSLOFormState {
  name: string
  service_name: string
  sli_type: string
  target_percentage: number
  time_window_days: number
  description: string
  promql_expr: string
}

export interface GrafanaSloQueryBody {
  expr: string
  target_percentage: number
  time_window_days: number
}

export interface SloLiveCompliancePoint {
  t: number
  v: number
}

export interface SloLiveComplianceResult {
  target: number
  compliance: number
  error_budget_remaining: number
  burn_rate: number
  series?: Array<{ data?: SloLiveCompliancePoint[] }>
}

export interface GrafanaDashboardListItem {
  uid: string
  title?: string
}

export interface GrafanaDashboardsApiResponse {
  dashboards?: GrafanaDashboardListItem[]
}

export interface GrafanaDashboardPanel {
  id: string | number
  title?: string
  type?: string
  targets?: Array<{ expr?: string }>
}

export interface GrafanaDashboardDetailResponse {
  panels?: GrafanaDashboardPanel[]
}

export interface CreateSLOApiPayload {
  name: string
  service_name: string
  sli_type: string
  target_percentage: number
  time_window_days: number
  description?: string
}

export const DEFAULT_SLO_SERVICES = [
  'api-gateway',
  'auth-service',
  'incident-service',
  'ai-service',
  'websocket-service',
] as const

export function mapApiToSLO(raw: SLOApi): SLO {
  const status: SLOStatus =
    raw.current_compliance >= raw.target_percentage
      ? 'meeting'
      : raw.error_budget_remaining <= 0
        ? 'breached'
        : raw.error_budget_remaining < 20
          ? 'at_risk'
          : 'meeting'
  return {
    id: raw.slo_id,
    name: raw.name,
    service: raw.service_name,
    target: raw.target_percentage,
    current: raw.current_compliance,
    errorBudgetRemaining: raw.error_budget_remaining,
    burnRate: raw.burn_rate,
    timeWindow: `${raw.time_window_days}d`,
    status,
    description: raw.description,
  }
}

export function defaultCreateSLOForm(serviceName: string): CreateSLOFormState {
  return {
    name: '',
    service_name: serviceName,
    sli_type: 'availability',
    target_percentage: 99.9,
    time_window_days: 30,
    description: '',
    promql_expr: '',
  }
}
