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
    </div>
  )
}
