import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import api from '../services/api'
import { Incident } from '../types/incident'
import { useRealTimeIncidents } from '../hooks/useRealTimeIncidents'
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

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const [alerts, setAlerts] = useState<Alert[]>([])

  // Use real-time incidents hook
  const { incidents, setIncidents } = useRealTimeIncidents([])
  const { isConnected } = useWebSocket()

  useEffect(() => {
    const fetchIncidents = async () => {
      try {
        const response = await api.get('/api/v1/incidents')
        setIncidents(response.data)
      } catch (error) {
        console.error('Failed to fetch incidents:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchIncidents()
  }, [setIncidents])

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
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)]) // Keep only 10 most recent
  })

  // Calculate statistics
  const stats = useMemo(() => {
    const total = incidents.length
    const critical = incidents.filter(i => i.severity === 'critical').length
    const open = incidents.filter(i => i.state === 'open' || i.state === 'investigating').length
    const resolved = incidents.filter(i => i.state === 'resolved').length

    return { total, critical, open, resolved }
  }, [incidents])

  // Prepare data for severity chart
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    }

    incidents.forEach(incident => {
      if (incident.severity in counts) {
        counts[incident.severity]++
      }
    })

    return [
      { name: 'Critical', value: counts.critical, color: '#ef4444' },
      { name: 'High', value: counts.high, color: '#f97316' },
      { name: 'Medium', value: counts.medium, color: '#eab308' },
      { name: 'Low', value: counts.low, color: '#3b82f6' },
    ].filter(item => item.value > 0)
  }, [incidents])

  // Prepare data for state chart
  const stateData = useMemo(() => {
    const counts: Record<string, number> = {
      open: 0,
      investigating: 0,
      resolved: 0,
      closed: 0,
    }

    incidents.forEach(incident => {
      if (incident.state in counts) {
        counts[incident.state]++
      }
    })

    return [
      { name: 'Open', value: counts.open },
      { name: 'Investigating', value: counts.investigating },
      { name: 'Resolved', value: counts.resolved },
      { name: 'Closed', value: counts.closed },
    ].filter(item => item.value > 0)
  }, [incidents])

  // Prepare data for timeline (last 7 days)
  const timelineData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    const incidentsByDay: Record<string, number> = {}
    last7Days.forEach(day => {
      incidentsByDay[day] = 0
    })

    incidents.forEach(incident => {
      const day = incident.detected_at?.split('T')[0] || incident.created_at?.split('T')[0]
      if (day && day in incidentsByDay) {
        incidentsByDay[day]++
      }
    })

    return last7Days.map(day => ({
      date: new Date(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      incidents: incidentsByDay[day],
    }))
  }, [incidents])

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
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
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
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.critical}</p>
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
              <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.open}</p>
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
              <p className="text-3xl font-bold text-green-600 mt-2">{stats.resolved}</p>
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
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Incident Timeline (7 Days)</h2>
          {timelineData.some(d => d.incidents > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="incidents" stroke="#3b82f6" fill="#93c5fd" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-gray-500">
              No incidents in the last 7 days
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
        ) : incidents.length === 0 ? (
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
                {incidents.slice(0, 10).map((incident) => (
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
