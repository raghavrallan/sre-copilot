import { create } from 'zustand'

type DeploymentStatusFilter = 'success' | 'failed' | 'in_progress' | ''

interface DeploymentsStoreState {
  serviceFilter: string
  statusFilter: DeploymentStatusFilter
  searchQuery: string
  expandedId: string | null
  setServiceFilter: (v: string) => void
  setStatusFilter: (v: DeploymentStatusFilter) => void
  setSearchQuery: (v: string) => void
  setExpandedId: (v: string | null) => void
  clearFilters: () => void
}

export const useDeploymentsStore = create<DeploymentsStoreState>()((set) => ({
  serviceFilter: '',
  statusFilter: '',
  searchQuery: '',
  expandedId: null,
  setServiceFilter: (serviceFilter) => set({ serviceFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setExpandedId: (expandedId) => set({ expandedId }),
  clearFilters: () => set({ serviceFilter: '', statusFilter: '', searchQuery: '' }),
}))
