import { create } from 'zustand'

export interface IncidentFiltersState {
  severity: string[]
  state: string[]
  service: string
}

interface IncidentsStoreState {
  filters: IncidentFiltersState
  searchQuery: string
  currentPage: number
  isScanning: boolean
  selectedIncidentId: string | null
  setFilters: (filters: IncidentFiltersState) => void
  setSearchQuery: (q: string) => void
  setCurrentPage: (p: number) => void
  setIsScanning: (v: boolean) => void
  setSelectedIncidentId: (id: string | null) => void
  resetFilters: () => void
}

const DEFAULT_FILTERS: IncidentFiltersState = { severity: [], state: [], service: '' }

export const useIncidentsStore = create<IncidentsStoreState>()((set) => ({
  filters: DEFAULT_FILTERS,
  searchQuery: '',
  currentPage: 1,
  isScanning: false,
  selectedIncidentId: null,
  setFilters: (filters) => set({ filters, currentPage: 1 }),
  setSearchQuery: (searchQuery) => set({ searchQuery, currentPage: 1 }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setIsScanning: (isScanning) => set({ isScanning }),
  setSelectedIncidentId: (selectedIncidentId) => set({ selectedIncidentId }),
  resetFilters: () => set({ filters: DEFAULT_FILTERS, searchQuery: '', currentPage: 1 }),
}))
