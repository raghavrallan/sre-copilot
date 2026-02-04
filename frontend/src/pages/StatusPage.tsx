import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'

interface Incident {
  id: string
  title: string
  description: string
  service_name: string
  state: string
  severity: string
  detected_at: string
  created_at: string
  resolved_at?: string
}

interface ServiceHealth {
  name: string
  status: 'operational' | 'degraded' | 'outage' | 'unknown'
  uptime: number
  lastIncident?: string
  incidentCount: number
}

interface TimelineEvent {
  id: string
  time: string
  type: 'incident_created' | 'incident_resolved'
  service: string
  severity: string
  title: string
}

const STATUS_COLORS = {
  operational: { bg: 'bg-green-500', text: 'text-green-600', label: 'Operational' },
  degraded: { bg: 'bg-yellow-500', text: 'text-yellow-600', label: 'Degraded' },
  outage: { bg: 'bg-red-500', text: 'text-red-600', label: 'Outage' },
  unknown: { bg: 'bg-gray-400', text: 'text-gray-500', label: 'Unknown' }
}

const SEVERITY_COLORS = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500'
}

export default function StatusPage() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const { isConnected } = useWebSocket()

  useEffect(() => {
    fetchIncidents()
  }, [])

  // Listen for real-time incident updates
  useWebSocketEvent<Incident>('incident.created', (newIncident) => {
    setIncidents(prev => [newIncident, ...prev])
  })

  useWebSocketEvent<Incident>('incident.updated', (updatedIncident) => {
    setIncidents(prev =>
      prev.map(inc => inc.id === updatedIncident.id ? updatedIncident : inc)
    )
  })

  const fetchIncidents = async () => {
    try {
      setLoading(true)
      const response = await api.get('/api/v1/incidents?limit=100')
      setIncidents(response.data.items || [])
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate service health from incidents
  const serviceHealth = useMemo(() => {
    const services = new Map<string, ServiceHealth>()
    const now = new Date()
    const rangeMs = timeRange === '24h' ? 24 * 60 * 60 * 1000
      : timeRange === '7d' ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000

    // Filter incidents within time range
    const rangeIncidents = incidents.filter(inc => {
      const incDate = new Date(inc.created_at)
      return now.getTime() - incDate.getTime() <= rangeMs
    })

    // Group by service
    rangeIncidents.forEach(inc => {
      if (!services.has(inc.service_name)) {
        services.set(inc.service_name, {
          name: inc.service_name,
          status: 'operational',
          uptime: 100,
          incidentCount: 0
        })
      }
      const service = services.get(inc.service_name)!
      service.incidentCount++

      // Check if there's an active incident
      if (inc.state !== 'resolved' && inc.state !== 'closed') {
        if (inc.severity === 'critical') {
          service.status = 'outage'
        } else if (service.status !== 'outage') {
          service.status = 'degraded'
        }
      }

      if (!service.lastIncident || new Date(inc.created_at) > new Date(service.lastIncident)) {
        service.lastIncident = inc.created_at
      }

      // Rough uptime calculation based on incidents
      const downtimePerIncident = inc.severity === 'critical' ? 2 : inc.severity === 'high' ? 1 : 0.5
      service.uptime = Math.max(0, 100 - (service.incidentCount * downtimePerIncident))
    })

    return Array.from(services.values()).sort((a, b) => {
      if (a.status === 'outage' && b.status !== 'outage') return -1
      if (b.status === 'outage' && a.status !== 'outage') return 1
      if (a.status === 'degraded' && b.status === 'operational') return -1
      if (b.status === 'degraded' && a.status === 'operational') return 1
      return b.incidentCount - a.incidentCount
    })
  }, [incidents, timeRange])

  // Calculate overall status
  const overallStatus = useMemo(() => {
    if (serviceHealth.some(s => s.status === 'outage')) return 'outage'
    if (serviceHealth.some(s => s.status === 'degraded')) return 'degraded'
    return 'operational'
  }, [serviceHealth])

  // Generate timeline events
  const timelineEvents = useMemo(() => {
    const events: TimelineEvent[] = []
    incidents.slice(0, 20).forEach(inc => {
      events.push({
        id: `${inc.id}-created`,
        time: inc.created_at,
        type: 'incident_created',
        service: inc.service_name,
        severity: inc.severity,
        title: inc.title
      })
      if (inc.resolved_at) {
        events.push({
          id: `${inc.id}-resolved`,
          time: inc.resolved_at,
          type: 'incident_resolved',
          service: inc.service_name,
          severity: inc.severity,
          title: inc.title
        })
      }
    })
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
  }, [incidents])

  // Calculate uptime bars for last 30 days
  const uptimeBars = useMemo(() => {
    const days = 30
    const bars: { date: string; status: 'operational' | 'degraded' | 'outage' }[] = []
    const now = new Date()

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const nextDate = new Date(date)
      nextDate.setDate(nextDate.getDate() + 1)

      const dayIncidents = incidents.filter(inc => {
        const incDate = new Date(inc.created_at)
        return incDate >= date && incDate < nextDate
      })

      let status: 'operational' | 'degraded' | 'outage' = 'operational'
      if (dayIncidents.some(inc => inc.severity === 'critical')) {
        status = 'outage'
      } else if (dayIncidents.length > 0) {
        status = 'degraded'
      }

      bars.push({
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        status
      })
    }

    return bars
  }, [incidents])

  // Active incidents count
  const activeIncidents = incidents.filter(inc => inc.state !== 'resolved' && inc.state !== 'closed')

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">System Status</h1>
            <div className="flex items-center gap-4">
              {/* WebSocket Status */}
              <div className="flex items-center gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-gray-500">{isConnected ? 'Live' : 'Offline'}</span>
              </div>
              {/* Time Range Selector */}
              <div className="flex bg-white rounded-lg border border-gray-200 p-1">
                {(['24h', '7d', '30d'] as const).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={`px-3 py-1 text-sm rounded ${
                      timeRange === range
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Overall Status Banner */}
          <div className={`rounded-lg p-4 ${
            overallStatus === 'operational' ? 'bg-green-50 border border-green-200' :
            overallStatus === 'degraded' ? 'bg-yellow-50 border border-yellow-200' :
            'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center gap-3">
              <span className={`w-4 h-4 rounded-full ${STATUS_COLORS[overallStatus].bg}`} />
              <span className={`font-semibold ${STATUS_COLORS[overallStatus].text}`}>
                {overallStatus === 'operational' ? 'All Systems Operational' :
                 overallStatus === 'degraded' ? 'Some Systems Degraded' :
                 'System Outage Detected'}
              </span>
              {activeIncidents.length > 0 && (
                <span className="ml-auto text-sm text-gray-600">
                  {activeIncidents.length} active incident{activeIncidents.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 30-Day Uptime Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">30-Day Uptime</h2>
            <span className="text-sm text-gray-500">
              {Math.round(uptimeBars.filter(b => b.status === 'operational').length / 30 * 100)}% uptime
            </span>
          </div>
          <div className="flex gap-1">
            {uptimeBars.map((bar, i) => (
              <div
                key={i}
                className="group relative flex-1"
              >
                <div
                  className={`h-8 rounded-sm cursor-pointer transition-all hover:opacity-80 ${
                    bar.status === 'operational' ? 'bg-green-400' :
                    bar.status === 'degraded' ? 'bg-yellow-400' :
                    'bg-red-400'
                  }`}
                />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                  <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {bar.date}: {bar.status}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Service Status Grid */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Service Status</h2>
          {serviceHealth.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No services with incidents in the selected time range</p>
            </div>
          ) : (
            <div className="space-y-3">
              {serviceHealth.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-3 h-3 rounded-full ${STATUS_COLORS[service.status].bg}`} />
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-500">
                        {service.incidentCount} incident{service.incidentCount !== 1 ? 's' : ''} in {timeRange}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Uptime Bar */}
                    <div className="w-32">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500">Uptime</span>
                        <span className={service.uptime >= 99 ? 'text-green-600' : service.uptime >= 95 ? 'text-yellow-600' : 'text-red-600'}>
                          {service.uptime.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            service.uptime >= 99 ? 'bg-green-500' :
                            service.uptime >= 95 ? 'bg-yellow-500' :
                            'bg-red-500'
                          }`}
                          style={{ width: `${service.uptime}%` }}
                        />
                      </div>
                    </div>
                    <span className={`text-sm font-medium ${STATUS_COLORS[service.status].text}`}>
                      {STATUS_COLORS[service.status].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Incidents Timeline */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent Incident Activity</h2>
          {timelineEvents.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No recent incidents</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
              <div className="space-y-4">
                {timelineEvents.slice(0, 15).map((event) => (
                  <div key={event.id} className="flex gap-4 relative">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center z-10 ${
                      event.type === 'incident_created'
                        ? SEVERITY_COLORS[event.severity as keyof typeof SEVERITY_COLORS] || 'bg-gray-400'
                        : 'bg-green-500'
                    }`}>
                      {event.type === 'incident_created' ? (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900 text-sm">
                          {event.type === 'incident_created' ? 'Incident Created' : 'Incident Resolved'}
                        </p>
                        <span className="text-xs text-gray-500">
                          {new Date(event.time).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{event.title}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {event.service}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded text-white ${
                          SEVERITY_COLORS[event.severity as keyof typeof SEVERITY_COLORS] || 'bg-gray-400'
                        }`}>
                          {event.severity}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {incidents.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Link
                to="/incidents"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all incidents →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
