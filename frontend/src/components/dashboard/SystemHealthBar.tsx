import { useEffect, useState } from 'react'
import { Server, AlertTriangle, Bell, Target, Rocket, Shield } from 'lucide-react'
import api from '../../services/api'
import StatCard from './StatCard'

interface HealthData {
  servicesHealthy: number
  servicesTotal: number
  activeIncidents: number
  criticalIncidents: number
  activeAlerts: number
  sloCompliance: number
  sloTotal: number
  deployments24h: number
  vulnerabilities: number
}

export default function SystemHealthBar() {
  const [data, setData] = useState<HealthData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const results = await Promise.allSettled([
          api.get('/api/v1/incidents-stats'),
          api.get('/api/v1/metrics/services-overview'),
          api.get('/api/v1/alerts/active-alerts'),
          api.get('/api/v1/slos'),
          api.get('/api/v1/deployments'),
          api.get('/api/v1/security/vulnerabilities/overview'),
        ])

        const incidentStats = results[0].status === 'fulfilled' ? results[0].value.data : null
        const servicesData = results[1].status === 'fulfilled' ? results[1].value.data : null
        const alertsData = results[2].status === 'fulfilled' ? results[2].value.data : null
        const slosData = results[3].status === 'fulfilled' ? results[3].value.data : null
        const deploymentsData = results[4].status === 'fulfilled' ? results[4].value.data : null
        const vulnData = results[5].status === 'fulfilled' ? results[5].value.data : null

        const services = Array.isArray(servicesData?.services) ? servicesData.services : (Array.isArray(servicesData) ? servicesData : [])
        const healthyCount = services.filter((s: any) => (s.errorRate ?? s.error_rate ?? 0) < 1).length

        const alerts = Array.isArray(alertsData?.alerts) ? alertsData.alerts : (Array.isArray(alertsData) ? alertsData : [])

        const slos = Array.isArray(slosData?.slos) ? slosData.slos : (Array.isArray(slosData) ? slosData : [])
        const compliantSlos = slos.filter((s: any) => (s.current_value ?? s.compliance ?? 100) >= (s.target ?? 99)).length

        const deployments = Array.isArray(deploymentsData?.deployments) ? deploymentsData.deployments : (Array.isArray(deploymentsData) ? deploymentsData : [])
        const now = Date.now()
        const deployments24h = deployments.filter((d: any) => {
          const ts = new Date(d.deployed_at || d.created_at || 0).getTime()
          return now - ts < 86400000
        }).length

        const vulnCount = vulnData?.total ?? vulnData?.total_vulnerabilities ?? (Array.isArray(vulnData?.vulnerabilities) ? vulnData.vulnerabilities.length : 0)

        const activeIncidents = (incidentStats?.by_state?.open ?? 0) + (incidentStats?.by_state?.investigating ?? 0)

        setData({
          servicesHealthy: healthyCount,
          servicesTotal: services.length,
          activeIncidents,
          criticalIncidents: incidentStats?.by_severity?.critical ?? 0,
          activeAlerts: alerts.length,
          sloCompliance: slos.length > 0 ? Math.round((compliantSlos / slos.length) * 100) : 100,
          sloTotal: slos.length,
          deployments24h,
          vulnerabilities: vulnCount,
        })
      } catch {
        // Graceful degradation - show zeros
        setData({
          servicesHealthy: 0, servicesTotal: 0, activeIncidents: 0,
          criticalIncidents: 0, activeAlerts: 0, sloCompliance: 100,
          sloTotal: 0, deployments24h: 0, vulnerabilities: 0,
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const servicesColor = !data ? 'green' : (data.servicesHealthy === data.servicesTotal ? 'green' : (data.servicesHealthy >= data.servicesTotal * 0.8 ? 'yellow' : 'red')) as 'green' | 'yellow' | 'red'
  const incidentColor = !data ? 'blue' : (data.activeIncidents === 0 ? 'green' : (data.criticalIncidents > 0 ? 'red' : 'yellow')) as 'green' | 'yellow' | 'red' | 'blue'
  const sloColor = !data ? 'purple' : (data.sloCompliance >= 99 ? 'green' : (data.sloCompliance >= 95 ? 'yellow' : 'red')) as 'green' | 'yellow' | 'red' | 'purple'

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      <StatCard
        title="Services"
        value={data ? `${data.servicesHealthy}/${data.servicesTotal}` : '0'}
        subtitle="healthy"
        icon={Server}
        color={servicesColor}
        loading={loading}
      />
      <StatCard
        title="Incidents"
        value={data?.activeIncidents ?? 0}
        subtitle="active"
        icon={AlertTriangle}
        color={incidentColor}
        loading={loading}
      />
      <StatCard
        title="Alerts"
        value={data?.activeAlerts ?? 0}
        subtitle="firing"
        icon={Bell}
        color={data && data.activeAlerts > 0 ? 'orange' : 'green'}
        loading={loading}
      />
      <StatCard
        title="SLO Compliance"
        value={data ? `${data.sloCompliance}%` : '100%'}
        subtitle={data ? `${data.sloTotal} SLOs tracked` : ''}
        icon={Target}
        color={sloColor}
        loading={loading}
      />
      <StatCard
        title="Deployments"
        value={data?.deployments24h ?? 0}
        subtitle="last 24h"
        icon={Rocket}
        color="blue"
        loading={loading}
      />
      <StatCard
        title="Vulnerabilities"
        value={data?.vulnerabilities ?? 0}
        subtitle="open"
        icon={Shield}
        color={data && data.vulnerabilities > 5 ? 'red' : (data && data.vulnerabilities > 0 ? 'yellow' : 'green')}
        loading={loading}
      />
    </div>
  )
}
