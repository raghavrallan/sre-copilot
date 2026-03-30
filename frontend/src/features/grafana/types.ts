/** List item from GET /api/v1/grafana/dashboards */
export interface GrafanaDashboard {
  uid: string
  title: string
  url: string
  tags: string[]
  type: string
  folderTitle: string
  folderUid: string
  isStarred: boolean
}

/** Response from GET /api/v1/grafana/dashboards */
export interface GrafanaResponse {
  grafana_url: string
  grafana_name: string
  dashboards: GrafanaDashboard[]
}

export interface PanelTarget {
  expr: string
  legendFormat: string
  refId: string
  datasource: any
}

export interface GrafanaPanel {
  id: number
  title: string
  type: string
  description: string
  datasource: any
  gridPos: { x: number; y: number; w: number; h: number }
  targets: PanelTarget[]
  thresholds: any
  alert: any
}

export interface DashboardSection {
  title: string
  collapsed: boolean
  panels: GrafanaPanel[]
}

/** Response from GET /api/v1/grafana/dashboards/:uid */
export interface DashboardDetail {
  uid: string
  title: string
  description: string
  tags: string[]
  timezone: string
  version: number
  folder: string
  created: string
  updated: string
  grafana_url: string
  panels: GrafanaPanel[]
  sections: DashboardSection[]
}

export interface Insight {
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  recommendation: string
}

/** Response from POST /api/v1/grafana/analyze */
export interface AnalysisResult {
  dashboard_title: string
  summary: string
  insights: Insight[]
  ai_powered: boolean
}

export interface SeriesData {
  name: string
  ref_id: string
  data: { t: number; v: number }[]
}

/** Response body from POST /api/v1/grafana/query-panel */
export interface QueryPanelResponse {
  series: SeriesData[]
}

/** Body for POST /api/v1/grafana/query-panel */
export interface QueryPanelRequest {
  dashboard_uid: string
  panel_id: number
  max_data_points: number
}

/** Body for POST /api/v1/grafana/create-incident */
export interface GrafanaCreateIncidentRequest {
  metric_name: string
  expr: string
  panel_title: string
  dashboard_uid: string
  panel_id: number
  severity: string
}
