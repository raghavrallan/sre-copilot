import { useState, useCallback } from 'react'
import { useWebSocketEvent } from './useWebSocketEvent'

export interface Incident {
  id: string
  title: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  status: 'open' | 'investigating' | 'resolved' | 'closed'
  created_at: string
  updated_at: string
  tenant_id: string
  source_alert?: any
}

/**
 * Hook to manage real-time incident updates via WebSocket
 */
export const useRealTimeIncidents = (initialIncidents: Incident[] = []) => {
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents)

  // Handle new incident creation
  useWebSocketEvent<Incident>('incident.created', useCallback((newIncident: Incident) => {
    setIncidents(prev => [newIncident, ...prev])
  }, []))

  // Handle incident updates
  useWebSocketEvent<Incident>('incident.updated', useCallback((updatedIncident: Incident) => {
    setIncidents(prev =>
      prev.map(incident =>
        incident.id === updatedIncident.id ? updatedIncident : incident
      )
    )
  }, []))

  // Handle incident deletion (if needed)
  useWebSocketEvent<{ id: string }>('incident.deleted', useCallback((data: { id: string }) => {
    setIncidents(prev => prev.filter(incident => incident.id !== data.id))
  }, []))

  return {
    incidents,
    setIncidents,
  }
}
