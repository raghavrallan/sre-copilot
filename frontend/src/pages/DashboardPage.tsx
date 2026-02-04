import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import api from '../services/api'
import { Incident } from '../types/incident'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'
import { AlertTriangle, Activity, CheckCircle, Clock } from 'lucide-react'

interface Alert {
  id: string
  alertname: string
  severity: string
  status: string
  startsAt: string
  endsAt?: string
  labels: Record<string, string>
  annotations: Record<string, string>
}

interface IncidentStats {
  total: number
  by_severity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  by_state: {
    open: number
    investigating: number
    resolved: number
    closed: number
  }
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [stats, setStats] = useState<IncidentStats | null>(null)
  const [recentIncidents, setRecentIncidents] = useState<Incident[]>([])
  const [timelineDays, setTimelineDays] = useState(7)
  const [timelineData, setTimelineData] = useState<{date: string, count: number}[]>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const { isConnected } = useWebSocket()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsResponse, incidentsResponse, timelineResponse] = await Promise.all([
          api.get('/api/v1/incidents-stats'),
          api.get('/api/v1/incidents?page=1&limit=10'),
          api.get(`/api/v1/incidents-timeline?days=${timelineDays}`)
        ])
        setStats(statsResponse.data)
        setRecentIncidents(incidentsResponse.data.items)
        setTimelineData(timelineResponse.data.timeline || [])
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Fetch timeline when days filter changes
  useEffect(() => {
    const fetchTimeline = async () => {
      setTimelineLoading(true)
      try {
        const response = await api.get(`/api/v1/incidents-timeline?days=${timelineDays}`)
        setTimelineData(response.data.timeline || [])
      } catch (error) {
        console.error('Failed to fetch timeline:', error)
      } finally {
        setTimelineLoading(false)
      }
    }

    if (!loading) {
      fetchTimeline()
    }
  }, [timelineDays, loading])

  // Listen for new alerts
  useWebSocketEvent<any>('alert.fired', (alertData: any) => {
    const newAlert: Alert = {
      id: `${alertData.alertname}-${Date.now()}`,
      alertname: alertData.alertname || 'Unknown Alert',
      severity: alertData.severity || 'warning',
      status: alertData.status || 'firing',
      startsAt: alertData.startsAt || new Date().toISOString(),
      labels: alertData.labels || {},
      annotations: alertData.annotations || {},
    }
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)])
  })

  // Listen for new incidents
  useWebSocketEvent<Incident>('incident.created', (newIncident) => {
    setRecentIncidents(prev => [newIncident, ...prev.slice(0, 9)])
    if (stats) {
      setStats({
        ...stats,
        total: stats.total + 1,
        by_severity: {
          ...stats.by_severity,
          [newIncident.severity]: (stats.by_severity[newIncident.severity as keyof typeof stats.by_severity] || 0) + 1
        },
        by_state: {
          ...stats.by_state,
          [newIncident.state]: (stats.by_state[newIncident.state as keyof typeof stats.by_state] || 0) + 1
        }
      })
    }
  })

  // Prepare data for severity chart
  const severityData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Critical', value: stats.by_severity.critical, color: '#ef4444' },
      { name: 'High', value: stats.by_severity.high, color: '#f97316' },
      { name: 'Medium', value: stats.by_severity.medium, color: '#eab308' },
      { name: 'Low', value: stats.by_severity.low, color: '#3b82f6' },
    ].filter(item => item.value > 0)
  }, [stats])

  // Prepare data for state chart
  const stateData = useMemo(() => {
    if (!stats) return []
    return [
      { name: 'Open', value: stats.by_state.open },
      { name: 'Investigating', value: stats.by_state.investigating },
      { name: 'Resolved', value: stats.by_state.resolved },
      { name: 'Closed', value: stats.by_state.closed },
    ].filter(item => item.value > 0)
  }, [stats])

  // Format timeline data for chart
  const formattedTimelineData = useMemo(() => {
    return timelineData.map(item => ({
      date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      incidents: item.count
    }))
  }, [timelineData])

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-blue-100 text-blue-800'
    }
  }

  const getStateColor = (state: string) => {
    switch (state) {
      case 'resolved':
        return 'bg-green-100 text-green-800'
      case 'investigating':
        return 'bg-yellow-100 text-yellow-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <div className="mt-2 flex items-center space-x-3">
            <p className="text-sm text-gray-600">
              Real-time monitoring and incident overview
            </p>
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Incidents</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.total.toLocaleString() || 0}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Activity className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical</p>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats?.by_severity.critical.toLocaleString() || 0}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open/Investigating</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">{((stats?.by_state.open || 0) + (stats?.by_state.investigating || 0)).toLocaleString()}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Resolved</p>
              <p className="text-3xl font-bold text-green-600 mt-2">{stats?.by_state.resolved.toLocaleString() || 0}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Incident Timeline */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Incident Timeline</h2>
            <select
              value={timelineDays}
              onChange={(e) => setTimelineDays(Number(e.target.value))}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
          </div>
          {timelineLoading ? (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              Loading...
            </div>
          ) : formattedTimelineData.some(d => d.incidents > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={formattedTimelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="incidents" stroke="#3b82f6" fill="#93c5fd" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              No incidents in the last {timelineDays} days
            </div>
          )}
        </div>

        {/* Severity Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Severity Distribution</h2>
          {severityData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={severityData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {severityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              No incidents to display
            </div>
          )}
        </div>

        {/* State Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident States</h2>
          {stateData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stateData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              No incidents to display
            </div>
          )}
        </div>

        {/* Recent Alerts Feed */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h2>
          {alerts.length > 0 ? (
            <div className="space-y-2 max-h-[250px] overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start space-x-2 p-2 bg-gray-50 rounded border border-gray-200"
                >
                  <AlertTriangle className={`w-4 h-4 mt-0.5 ${
                    alert.severity === 'critical' ? 'text-red-500' : 'text-orange-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {alert.alertname}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(alert.startsAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              No recent alerts
            </div>
          )}
        </div>
      </div>

      {/* Recent Incidents Table */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Recent Incidents</h2>
          <Link
            to="/incidents"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View all →
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : recentIncidents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No incidents found. System is running smoothly!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    State
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Detected
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentIncidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link
                        to={`/incidents/${incident.id}`}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {incident.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {incident.service_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getSeverityColor(
                          incident.severity
                        )}`}
                      >
                        {incident.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStateColor(
                          incident.state
                        )}`}
                      >
                        {incident.state}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(incident.detected_at || incident.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
