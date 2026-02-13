import { useWebSocket } from '../contexts/WebSocketContext'
import SystemHealthBar from '../components/dashboard/SystemHealthBar'
import ServicesOverview from '../components/dashboard/ServicesOverview'
import IncidentTimeline from '../components/dashboard/IncidentTimeline'
import ActiveAlerts from '../components/dashboard/ActiveAlerts'
import WebVitalsCard from '../components/dashboard/WebVitalsCard'
import SLOStatusCard from '../components/dashboard/SLOStatusCard'
import RecentDeployments from '../components/dashboard/RecentDeployments'
import RecentIncidents from '../components/dashboard/RecentIncidents'

export default function DashboardPage() {
  const { isConnected } = useWebSocket()

  return (
    <div className="px-4 sm:px-0 pb-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Observability command center</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 border border-gray-200">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
          <span className="text-xs font-medium text-gray-600">
            {isConnected ? 'Live' : 'Offline'}
          </span>
        </div>
      </div>

      {/* Section 1: System Health Bar */}
      <SystemHealthBar />

      {/* Section 2: Services Health Overview */}
      <ServicesOverview />

      {/* Section 3: Incidents + Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <IncidentTimeline />
        <ActiveAlerts />
      </div>

      {/* Section 4: Observability Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <WebVitalsCard />
        <SLOStatusCard />
        <RecentDeployments />
      </div>

      {/* Section 5: Recent Incidents Table */}
      <RecentIncidents />
    </div>
  )
}
