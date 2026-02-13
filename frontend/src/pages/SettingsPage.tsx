import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  User,
  Key,
  Cloud,
  Workflow,
  BarChart3,
  Bell,
  Shield,
  Link2,
} from 'lucide-react'
import GeneralSettings from '../components/settings/GeneralSettings'
import MonitoringSettings from '../components/settings/MonitoringSettings'
import SecuritySettings from '../components/settings/SecuritySettings'
import NotificationSettings from '../components/settings/NotificationSettings'
import ConnectionSettings from '../components/settings/ConnectionSettings'
import ApiKeysSettings from '../components/settings/ApiKeysSettings'
import CloudProviderSettings from '../components/settings/CloudProviderSettings'
import CICDSettings from '../components/settings/CICDSettings'

type TabType =
  | 'general'
  | 'api-keys'
  | 'cloud-providers'
  | 'cicd'
  | 'monitoring'
  | 'notifications'
  | 'security'
  | 'connections'

interface TabConfig {
  id: TabType
  label: string
  icon: React.ReactNode
}

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get('tab') as TabType) || 'general'
  )

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    setSearchParams({ tab })
  }

  const tabs: TabConfig[] = [
    { id: 'general', label: 'General', icon: <User className="w-4 h-4" /> },
    { id: 'api-keys', label: 'API Keys', icon: <Key className="w-4 h-4" /> },
    { id: 'cloud-providers', label: 'Cloud Providers', icon: <Cloud className="w-4 h-4" /> },
    { id: 'cicd', label: 'CI/CD', icon: <Workflow className="w-4 h-4" /> },
    { id: 'monitoring', label: 'Monitoring', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'connections', label: 'Connections', icon: <Link2 className="w-4 h-4" /> },
  ]

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage your account and preferences</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <nav className="flex gap-6 flex-wrap">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 pb-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div>
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'api-keys' && <ApiKeysSettings />}
          {activeTab === 'cloud-providers' && <CloudProviderSettings />}
          {activeTab === 'cicd' && <CICDSettings />}
          {activeTab === 'monitoring' && <MonitoringSettings />}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && <SecuritySettings />}
          {activeTab === 'connections' && <ConnectionSettings />}
        </div>
      </div>
    </div>
  )
}
