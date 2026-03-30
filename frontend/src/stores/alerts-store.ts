import { create } from 'zustand'

type AlertTab = 'active' | 'grafana' | 'conditions' | 'policies' | 'channels' | 'muting'

interface AlertsStoreState {
  activeTab: AlertTab
  setActiveTab: (tab: AlertTab) => void
}

export const useAlertsStore = create<AlertsStoreState>()((set) => ({
  activeTab: 'active',
  setActiveTab: (activeTab) => set({ activeTab }),
}))
