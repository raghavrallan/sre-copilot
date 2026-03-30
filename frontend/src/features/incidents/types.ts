export interface Incident {
  id: string
  title: string
  description: string
  service_name: string
  state: 'detected' | 'acknowledged' | 'investigating' | 'resolved'
  severity: 'critical' | 'high' | 'medium' | 'low'
  detected_at: string
  acknowledged_at?: string
  resolved_at?: string
  created_at: string
}

export interface Hypothesis {
  id: string
  incident_id: string
  claim: string
  description: string
  confidence_score: number
  rank: number
  supporting_evidence: string[]
}

export interface CreateIncidentRequest {
  title: string
  description: string
  service_name: string
  severity: string
}

export interface ActivityItem {
  id: string
  incident_id: string
  activity_type: string
  content: string
  old_value?: string
  new_value?: string
  user_id?: string
  user_name: string
  user_email: string
  created_at: string
}

export interface IncidentFilters {
  severity: string[]
  state: string[]
  service: string
}

export const STATES = [
  { value: 'detected', label: 'Detected', color: 'bg-gray-500' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-blue-500' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
] as const

export const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
] as const
