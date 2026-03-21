import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { Incident, CreateIncidentRequest } from '../types/incident'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'
import { IncidentFilters, FilterState } from '../components/common/IncidentFilters'
import { Pagination } from '../components/common/Pagination'
import { ListSkeleton } from '../components/common/LoadingSkeleton'
import { ExportButton } from '../components/common/ExportButton'
import { BarChart3, Loader2, AlertTriangle, Zap } from 'lucide-react'

export default function IncidentsPage() {
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({
    severity: [],
    state: [],
    service: '',
  })
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const itemsPerPage = 20

  const [formData, setFormData] = useState<CreateIncidentRequest>({
    title: '',
    description: '',
    service_name: '',
    severity: 'medium',
  })

  const [incidents, setIncidents] = useState<Incident[]>([])
  const { isConnected, connectionStatus } = useWebSocket()

  // Grafana anomaly scan state
  const [showGrafanaModal, setShowGrafanaModal] = useState(false)
  const [grafanaDashboards, setGrafanaDashboards] = useState<any[]>([])
  const [selectedDashboard, setSelectedDashboard] = useState('')
  const [scanning, setScanning] = useState(false)
  const [anomalies, setAnomalies] = useState<any[]>([])
  const [creatingFromAnomaly, setCreatingFromAnomaly] = useState<string | null>(null)

  // Listen for real-time updates
  useWebSocketEvent<Incident>('incident.created', (newIncident) => {
    if (currentPage === 1) {
      setIncidents(prev => [newIncident, ...prev.slice(0, itemsPerPage - 1)])
      setTotalItems(prev => prev + 1)
    }
  })

  useWebSocketEvent<Incident>('incident.updated', (updatedIncident) => {
    setIncidents(prev => prev.map(inc =>
      inc.id === updatedIncident.id ? updatedIncident : inc
    ))
  })

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
      })

      if (filters.severity.length === 1) {
        params.append('severity', filters.severity[0])
      }
      if (filters.state.length === 1) {
        params.append('state', filters.state[0])
      }
      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const response = await api.get(`/api/v1/incidents?${params.toString()}`)
      setIncidents(response.data.items)
      setTotalPages(response.data.pages)
      setTotalItems(response.data.total)
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters, searchQuery])

  useEffect(() => {
    fetchIncidents()
  }, [fetchIncidents])

  const handleCreateIncident = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await api.post('/api/v1/incidents', formData)
      setShowCreateForm(false)
      setFormData({
        title: '',
        description: '',
        service_name: '',
        severity: 'medium',
      })
      fetchIncidents()
    } catch (error) {
      console.error('Failed to create incident:', error)
    }
  }

  // Handle filter changes - reset to page 1
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }

  // Handle search changes - reset to page 1
  const handleSearch = (query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const openGrafanaModal = async () => {
    setShowGrafanaModal(true)
    setAnomalies([])
    setSelectedDashboard('')
    try {
      const resp = await api.get('/api/v1/grafana/dashboards')
      setGrafanaDashboards((resp.data.dashboards || []).filter((d: any) => d.uid))
    } catch { setGrafanaDashboards([]) }
  }

  const scanForAnomalies = async () => {
    if (!selectedDashboard) return
    setScanning(true)
    setAnomalies([])
    try {
      const resp = await api.post('/api/v1/grafana/detect-anomalies', { dashboard_uid: selectedDashboard, sensitivity: 2.0 })
      setAnomalies(resp.data.anomalies || [])
    } catch { /* ignore */ }
    setScanning(false)
  }

  const createFromAnomaly = async (anomaly: any) => {
    setCreatingFromAnomaly(anomaly.metric_name)
    try {
      await api.post('/api/v1/grafana/create-incident', {
        metric_name: anomaly.metric_name,
        expr: anomaly.expr,
        panel_title: anomaly.panel_title,
        dashboard_uid: selectedDashboard,
        panel_id: anomaly.panel_id,
        severity: anomaly.max_severity === 'critical' ? 'critical' : 'high',
        latest_value: anomaly.latest_value,
        expected_value: anomaly.expected_value,
      })
      setShowGrafanaModal(false)
      fetchIncidents()
    } catch (err) { console.error(err) }
    setCreatingFromAnomaly(null)
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Incidents</h1>
          <div className="mt-2 flex items-center space-x-3">
            <p className="text-sm text-gray-600">
              Manage and track all your incidents
            </p>
            <div className="flex items-center space-x-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
                }`}
              />
              <span className="text-xs text-gray-500">
                {isConnected ? 'Live' : connectionStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex space-x-3">
          <ExportButton
            data={incidents}
            filename={`incidents-${new Date().toISOString().split('T')[0]}`}
          />
          <button
            onClick={openGrafanaModal}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" /> From Grafana
          </button>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : '+ New Incident'}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Create New Incident</h2>
          <form onSubmit={handleCreateIncident} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Title</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Service Name</label>
              <input
                type="text"
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                value={formData.service_name}
                onChange={(e) => setFormData({ ...formData, service_name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Severity</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Incident
            </button>
          </form>
        </div>
      )}

      {/* Filters */}
      <IncidentFilters
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
      />

      {/* Results Summary */}
      <div className="mb-4 text-sm text-gray-600">
        Showing {incidents.length} of {totalItems.toLocaleString()} incidents
        {(searchQuery || filters.severity.length > 0 || filters.state.length > 0) && ' (filtered)'}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        {loading ? (
          <ListSkeleton count={10} />
        ) : incidents.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No incidents found matching your criteria.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <Link
                        to={`/incidents/${incident.id}`}
                        className="text-lg font-semibold text-blue-600 hover:text-blue-800"
                      >
                        {incident.title}
                      </Link>
                      <p className="text-sm text-gray-600 mt-1">{incident.description}</p>
                      <div className="mt-2 flex space-x-4 text-sm text-gray-500">
                        <span>Service: {incident.service_name}</span>
                        <span>Detected: {new Date(incident.detected_at).toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 items-end">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          incident.severity === 'critical'
                            ? 'bg-red-100 text-red-800'
                            : incident.severity === 'high'
                            ? 'bg-orange-100 text-orange-800'
                            : incident.severity === 'medium'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {incident.severity}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          incident.state === 'resolved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {incident.state}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      {/* Grafana Anomaly Scan Modal */}
      {showGrafanaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-orange-600" /> Create Incident from Grafana
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Dashboard</label>
                <select
                  value={selectedDashboard}
                  onChange={(e) => setSelectedDashboard(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a dashboard...</option>
                  {grafanaDashboards.map(d => (
                    <option key={d.uid} value={d.uid}>{d.title}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={scanForAnomalies}
                disabled={!selectedDashboard || scanning}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-medium"
              >
                {scanning ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning metrics...</> : <><Zap className="w-4 h-4" /> Scan for Anomalies</>}
              </button>

              {anomalies.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">{anomalies.length} anomal{anomalies.length === 1 ? 'y' : 'ies'} detected:</p>
                  {anomalies.map((a, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{a.panel_title || a.metric_name}</p>
                          <p className="text-xs text-gray-500 truncate">{a.metric_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${a.max_severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {a.max_severity}
                            </span>
                            <span className="text-xs text-gray-400">{a.anomaly_count} anomalous points</span>
                          </div>
                        </div>
                        <button
                          onClick={() => createFromAnomaly(a)}
                          disabled={creatingFromAnomaly === a.metric_name}
                          className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50 shrink-0"
                        >
                          {creatingFromAnomaly === a.metric_name ? 'Creating...' : 'Create Incident'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!scanning && anomalies.length === 0 && selectedDashboard && (
                <p className="text-sm text-gray-500 text-center py-2">No anomalies detected. Select a dashboard and scan.</p>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button onClick={() => setShowGrafanaModal(false)} className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
