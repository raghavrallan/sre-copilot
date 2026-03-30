export interface VulnerabilityApi {
  vuln_id: string
  cve_id: string
  title: string
  description: string
  severity: string
  service_name: string
  package_name: string
  installed_version: string
  fixed_version: string | null
  source: string
  status: string
  first_detected: string
  last_seen: string
}

export interface SecurityOverviewApi {
  total: number
  by_severity: Record<string, number>
  by_status: Record<string, number>
  by_service: Record<string, number>
}

export type VulnerabilitySeverity = 'critical' | 'high' | 'medium' | 'low'

export type VulnerabilityStatus =
  | 'open'
  | 'patched'
  | 'ignored'
  | 'in_progress'
  | 'false_positive'

export interface Vulnerability {
  id: string
  cveId: string
  title: string
  severity: VulnerabilitySeverity
  service: string
  package: string
  installedVersion: string
  fixedVersion: string
  status: VulnerabilityStatus
  source: string
  description: string
}
