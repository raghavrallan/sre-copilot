export type ErrorGroupStatus = 'unresolved' | 'investigating' | 'resolved' | 'ignored'

export interface ErrorGroup {
  fingerprint: string
  errorClass: string
  normalizedMessage: string
  status: ErrorGroupStatus
  assignee?: string
  notes?: string
}

export interface ErrorGroupItem {
  fingerprint: string
  errorClass: string
  normalizedMessage: string
  occurrenceCount: number
  firstSeen: string
  lastSeen: string
  trendData: Array<{ time: string; count: number }>
  services: string[]
  status: ErrorGroupStatus
}

export interface OccurrenceApi {
  timestamp: string
  attributes?: Record<string, string>
  stack_trace?: string
}

export interface ErrorGroupApi {
  fingerprint: string
  service_name: string
  error_class: string
  message: string
  occurrence_count: number
  first_seen: string
  last_seen: string
  status: ErrorGroupStatus
  assignee: string | null
  notes: string | null
  occurrences?: OccurrenceApi[]
  stack_trace?: string
}

export interface ErrorGroupDisplay extends ErrorGroup {
  stackTrace: string
  occurrenceTimeline: Array<{ time: string; count: number }>
  recentOccurrences: Array<{
    timestamp: string
    attributes: Record<string, string>
    stackTracePreview: string
  }>
  errorProfiles: Array<{ attribute: string; value: string; count: number }>
}

export interface ErrorTriagePatchBody {
  status?: ErrorGroupStatus
  assignee?: string
  notes?: string
}
