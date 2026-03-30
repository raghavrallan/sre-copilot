export type Tab =
  | 'active'
  | 'grafana'
  | 'conditions'
  | 'policies'
  | 'channels'
  | 'muting'

export interface GrafanaRule {
  uid: string
  title: string
  state: string
  condition?: string
  folder_uid?: string
  rule_group?: string
  for_duration?: string
  labels: Record<string, string>
  annotations: Record<string, string>
  is_paused: boolean
  dashboard_uid?: string
  panel_id?: number
}

export interface ActiveAlert {
  alert_id: string
  condition_id: string
  condition_name?: string
  service_name?: string
  fired_at: string
  severity: string
  message?: string
  status?: string
  acknowledged?: boolean
}

export interface Condition {
  condition_id: string
  name: string
  metric_name: string
  operator: string
  threshold: number
  duration_seconds: number
  severity: string
  service_name: string
  enabled: boolean
  created_at?: string
}

export interface Policy {
  policy_id: string
  name: string
  description?: string
  condition_ids?: string[]
  incident_preference: string
  enabled?: boolean
}

export interface Channel {
  channel_id: string
  name: string
  type: string
  config?: Record<string, unknown>
  enabled: boolean
  created_at?: string
}

export interface MutingRule {
  rule_id: string
  name: string
  start_time?: string
  end_time?: string
  repeat?: string
  condition_ids?: string[]
  enabled?: boolean
}

/** Response shape for GET `/api/v1/grafana/alert-rules` (used by typed API layer). */
export interface GrafanaAlertRulesResponse {
  rules: GrafanaRule[]
  grafana_url?: string
}

/** Body for POST `/api/v1/grafana/create-incident` (derived from `createIncidentFromAlert` usage). */
export interface GrafanaCreateIncidentRequest {
  metric_name: string
  panel_title: string
  dashboard_uid: string
  panel_id?: number
  severity: string
  service_name: string
}
