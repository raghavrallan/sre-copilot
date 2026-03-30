import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/auth-store'
import { WebSocketProvider } from './contexts/WebSocketContext'
import LoginPage from './features/auth/pages/LoginPage'
import RegisterPage from './features/auth/pages/RegisterPage'
import OnboardingPage from './features/auth/pages/OnboardingPage'
import DashboardPage from './features/dashboard/pages/DashboardPage'
import DashboardsPage from './features/dashboard/pages/DashboardsPage'
import DashboardEditorPage from './features/dashboard/pages/DashboardEditorPage'
import IncidentsPage from './features/incidents/pages/IncidentsPage'
import IncidentDetailPage from './features/incidents/pages/IncidentDetailPage'
import AlertsPage from './features/alerts/pages/AlertsPage'
import DeploymentsPage from './features/deployments/pages/DeploymentsPage'
import GrafanaDashboardsPage from './features/grafana/pages/GrafanaDashboardsPage'
import GrafanaDashboardDetailPage from './features/grafana/pages/GrafanaDashboardDetailPage'
import SLOsPage from './features/slos/pages/SLOsPage'
import APMPage from './features/apm/pages/APMPage'
import APMServiceDetailPage from './features/apm/pages/APMServiceDetailPage'
import TracingPage from './features/tracing/pages/TracingPage'
import TraceDetailPage from './features/tracing/pages/TraceDetailPage'
import ErrorsPage from './features/errors/pages/ErrorsPage'
import ErrorGroupDetailPage from './features/errors/pages/ErrorGroupDetailPage'
import LogsPage from './features/logs/pages/LogsPage'
import InfrastructurePage from './features/infrastructure/pages/InfrastructurePage'
import SecurityPage from './features/security/pages/SecurityPage'
import SyntheticsPage from './features/synthetics/pages/SyntheticsPage'
import BrowserMonitoringPage from './features/monitoring/pages/BrowserMonitoringPage'
import SettingsPage from './features/settings/pages/SettingsPage'
import StatusPage from './features/status/pages/StatusPage'
import ServiceMapPage from './features/service-map/pages/ServiceMapPage'
import AnalyticsPage from './features/analytics/pages/AnalyticsPage'
import Layout from './components/layout/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

function RoleProtectedRoute({ children, allowedRoles }: { children: React.ReactNode; allowedRoles: string[] }) {
  const { isAuthenticated, currentProject } = useAuthStore()

  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }

  const userRole = currentProject?.role
  if (userRole && !allowedRoles.includes(userRole)) {
    return <Navigate to="/" />
  }

  return <>{children}</>
}

function App() {
  return (
    <WebSocketProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="incidents" element={<IncidentsPage />} />
          <Route path="incidents/:id" element={<IncidentDetailPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="apm" element={<APMPage />} />
          <Route path="apm/:serviceName" element={<APMServiceDetailPage />} />
          <Route path="infrastructure" element={<InfrastructurePage />} />
          <Route path="service-map" element={<ServiceMapPage />} />
          <Route path="slos" element={<SLOsPage />} />
          <Route path="dashboards" element={<DashboardsPage />} />
          <Route path="dashboards/new" element={<DashboardEditorPage />} />
          <Route path="dashboards/grafana" element={<GrafanaDashboardsPage />} />
          <Route path="dashboards/grafana/:uid" element={<GrafanaDashboardDetailPage />} />
          <Route path="dashboards/:id" element={<DashboardEditorPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="synthetics" element={<SyntheticsPage />} />
          <Route path="deployments" element={<DeploymentsPage />} />
          <Route path="browser" element={<BrowserMonitoringPage />} />
          <Route path="security" element={<SecurityPage />} />
          <Route path="status" element={<StatusPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="logs" element={<LogsPage />} />
          <Route path="errors" element={<ErrorsPage />} />
          <Route path="errors/:fingerprint" element={<ErrorGroupDetailPage />} />
          <Route path="tracing" element={<TracingPage />} />
          <Route path="tracing/:traceId" element={<TraceDetailPage />} />
          <Route path="settings" element={<RoleProtectedRoute allowedRoles={['owner', 'admin', 'engineer']}><SettingsPage /></RoleProtectedRoute>} />
        </Route>
      </Routes>
    </WebSocketProvider>
  )
}

export default App
