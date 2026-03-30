import { useState, useEffect, useCallback } from 'react'
import { useWebSocketEvent } from '../../../hooks/useWebSocketEvent'
import * as incidentsApi from '../api'
import type { Incident, CreateIncidentRequest } from '../types'
import type { FilterState } from '../../../components/common/IncidentFilters'

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalItems, setTotalItems] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>({ severity: [], state: [], service: '' })
  const itemsPerPage = 20

  const fetchIncidents = useCallback(async () => {
    setLoading(true)
    try {
      const result = await incidentsApi.fetchIncidents({
        page: currentPage,
        limit: itemsPerPage,
        severity: filters.severity.length === 1 ? filters.severity[0] : undefined,
        state: filters.state.length === 1 ? filters.state[0] : undefined,
        search: searchQuery || undefined,
      })
      setIncidents(result.items)
      setTotalPages(result.pages)
      setTotalItems(result.total)
    } catch (error) {
      console.error('Failed to fetch incidents:', error)
    } finally {
      setLoading(false)
    }
  }, [currentPage, filters, searchQuery])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  useWebSocketEvent<Incident>('incident.created', (newIncident) => {
    if (currentPage === 1) {
      setIncidents(prev => [newIncident, ...prev.slice(0, itemsPerPage - 1)])
      setTotalItems(prev => prev + 1)
    }
  })

  useWebSocketEvent<Incident>('incident.updated', (updatedIncident) => {
    setIncidents(prev => prev.map(inc => inc.id === updatedIncident.id ? updatedIncident : inc))
  })

  const handleFilterChange = useCallback((newFilters: FilterState) => {
    setFilters(newFilters)
    setCurrentPage(1)
  }, [])

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    setCurrentPage(1)
  }, [])

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const create = useCallback(async (body: CreateIncidentRequest) => {
    await incidentsApi.createIncident(body)
    fetchIncidents()
  }, [fetchIncidents])

  return {
    incidents,
    loading,
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    filters,
    searchQuery,
    fetchIncidents,
    handleFilterChange,
    handleSearch,
    handlePageChange,
    create,
  }
}
