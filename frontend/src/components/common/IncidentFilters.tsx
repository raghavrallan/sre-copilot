import { useState } from 'react'
import { Search, Filter, X } from 'lucide-react'

interface IncidentFiltersProps {
  onFilterChange: (filters: FilterState) => void
  onSearch: (query: string) => void
}

export interface FilterState {
  severity: string[]
  state: string[]
  service: string
}

export const IncidentFilters = ({ onFilterChange, onSearch }: IncidentFiltersProps) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    severity: [],
    state: [],
    service: '',
  })

  const severityOptions = ['critical', 'high', 'medium', 'low']
  const stateOptions = ['open', 'investigating', 'resolved', 'closed']

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    onSearch(value)
  }

  const toggleSeverity = (severity: string) => {
    const newSeverities = filters.severity.includes(severity)
      ? filters.severity.filter(s => s !== severity)
      : [...filters.severity, severity]

    const newFilters = { ...filters, severity: newSeverities }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const toggleState = (state: string) => {
    const newStates = filters.state.includes(state)
      ? filters.state.filter(s => s !== state)
      : [...filters.state, state]

    const newFilters = { ...filters, state: newStates }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleServiceChange = (service: string) => {
    const newFilters = { ...filters, service }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const clearFilters = () => {
    const clearedFilters = { severity: [], state: [], service: '' }
    setFilters(clearedFilters)
    setSearchQuery('')
    onFilterChange(clearedFilters)
    onSearch('')
  }

  const hasActiveFilters = filters.severity.length > 0 || filters.state.length > 0 || filters.service !== '' || searchQuery !== ''

  return (
    <div className="bg-white shadow rounded-lg p-4 mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search incidents..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 flex items-center space-x-2"
        >
          <Filter className="w-4 h-4" />
          <span>Filters</span>
          {hasActiveFilters && (
            <span className="ml-1 px-2 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              Active
            </span>
          )}
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 flex items-center space-x-2"
          >
            <X className="w-4 h-4" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Filter Options */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Severity Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Severity</label>
            <div className="space-y-2">
              {severityOptions.map((severity) => (
                <label key={severity} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.severity.includes(severity)}
                    onChange={() => toggleSeverity(severity)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{severity}</span>
                </label>
              ))}
            </div>
          </div>

          {/* State Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
            <div className="space-y-2">
              {stateOptions.map((state) => (
                <label key={state} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.state.includes(state)}
                    onChange={() => toggleState(state)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700 capitalize">{state}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Service Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service</label>
            <input
              type="text"
              placeholder="Filter by service..."
              value={filters.service}
              onChange={(e) => handleServiceChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  )
}
