export interface Incident {
  id: string
  title: string
  description: string
  service_name: string
  state: 'detected' | 'acknowledged' | 'investigating' | 'resolved'
  severity: 'critical' | 'high' | 'medium' | 'low'
  detected_at: string
  created_at: string
}

export interface Hypothesis {
  id: string
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
