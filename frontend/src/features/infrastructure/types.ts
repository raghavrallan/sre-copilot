export interface HostLatestMetrics {
  hostname?: string
  timestamp?: string
  cpu_percent?: number
  memory_percent?: number
  disk_usage?: number
  network_io?: { bytes_sent?: number; bytes_recv?: number }
}

export interface HostListItem {
  hostname: string
  latest_metrics: HostLatestMetrics
}

export interface HostMetricsHistoryPoint {
  timestamp?: string
  cpu_percent?: number
  memory_percent?: number
  disk_usage?: number
  network_io?: { bytes_sent?: number; bytes_recv?: number }
}

export interface HostProcess {
  pid?: number
  name?: string
  cpu_percent?: number
  memory_percent?: number
}

export interface HostContainer {
  id?: string
  name?: string
  state?: string
  image?: string
}

export interface HostDetail extends HostListItem {
  metrics_history?: HostMetricsHistoryPoint[]
  processes?: HostProcess[]
  containers?: HostContainer[]
}

export interface ContainerRow {
  id: string
  name: string
  image?: string
  cpu?: number
  memory?: string
  status: string
}

export interface ProcessRow {
  pid: number
  name: string
  cpu: number
  memory: string
  status: string
}
