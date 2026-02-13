import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './lib/stores/auth-store'
import { WebSocketProvider } from './contexts/WebSocketContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import IncidentsPage from './pages/IncidentsPage'
import IncidentDetailPage from './pages/IncidentDetailPage'
import AnalyticsPage from './pages/AnalyticsPage'
import APMPage from './pages/APMPage'
import APMServiceDetailPage from './pages/APMServiceDetailPage'
import InfrastructurePage from './pages/InfrastructurePage'
import ServiceMapPage from './pages/ServiceMapPage'
import SLOsPage from './pages/SLOsPage'
import DashboardsPage from './pages/DashboardsPage'
import DashboardEditorPage from './pages/DashboardEditorPage'
import AlertsPage from './pages/AlertsPage'
import SyntheticsPage from './pages/SyntheticsPage'
import DeploymentsPage from './pages/DeploymentsPage'
import BrowserMonitoringPage from './pages/BrowserMonitoringPage'
import SecurityPage from './pages/SecurityPage'
import SettingsPage from './pages/SettingsPage'
import StatusPage from './pages/StatusPage'
import OnboardingPage from './pages/OnboardingPage'
import LogsPage from './pages/LogsPage'
import ErrorsPage from './pages/ErrorsPage'
import ErrorGroupDetailPage from './pages/ErrorGroupDetailPage'
import TracingPage from './pages/TracingPage'
import TraceDetailPage from './pages/TraceDetailPage'
import Layout from './components/Layout'

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
