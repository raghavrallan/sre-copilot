import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, ArrowRight, Bell, BarChart3 } from 'lucide-react'
import api from '../../services/api'
import { useWebSocketEvent } from '../../hooks/useWebSocketEvent'

interface Alert {
  id: string
  alertname: string
  severity: string
  status: string
  startsAt: string
  service?: string
  source?: 'platform' | 'grafana'
  labels?: Record<string, string>
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ActiveAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAll = async () => {
      const combined: Alert[] = []

      // Platform alerts
      try {
        const { data } = await api.get('/api/v1/alerts/active-alerts')
        const list = Array.isArray(data?.alerts) ? data.alerts : (Array.isArray(data) ? data : [])
        list.slice(0, 8).forEach((a: any, i: number) => {
          combined.push({
            id: a.id || `alert-${i}`,
            alertname: a.alertname || a.name || 'Unknown',
            severity: a.severity || a.labels?.severity || 'warning',
            status: a.status || 'firing',
            startsAt: a.startsAt || a.starts_at || a.created_at || new Date().toISOString(),
            service: a.service || a.labels?.service || a.labels?.job || undefined,
            source: 'platform',
            labels: a.labels,
          })
        })
      } catch { /* ignore */ }

      // Grafana alert rules (firing only)
      try {
        const { data } = await api.get('/api/v1/grafana/alert-rules')
        const rules = data?.rules || []
        rules.filter((r: any) => ['alerting', 'firing', 'pending'].includes(r.state))
          .slice(0, 5)
          .forEach((r: any, i: number) => {
            combined.push({
              id: `gf-${r.uid || i}`,
              alertname: r.title || 'Grafana Alert',
              severity: r.labels?.severity || (r.state === 'firing' ? 'critical' : 'warning'),
              status: r.state || 'firing',
              startsAt: new Date().toISOString(),
              service: r.labels?.service || r.labels?.job || undefined,
              source: 'grafana',
              labels: r.labels,
            })
          })
      } catch { /* Grafana optional */ }

      setAlerts(combined.slice(0, 10))
      setLoading(false)
    }
    fetchAll()
  }, [])

  useWebSocketEvent<any>('alert.fired', (alertData: any) => {
    const newAlert: Alert = {
      id: `ws-${Date.now()}`,
      alertname: alertData.alertname || 'Unknown Alert',
      severity: alertData.severity || 'warning',
      status: alertData.status || 'firing',
      startsAt: alertData.startsAt || new Date().toISOString(),
      service: alertData.service || alertData.labels?.service || undefined,
      source: 'platform',
      labels: alertData.labels,
    }
    setAlerts(prev => [newAlert, ...prev.slice(0, 9)])
  })

  const severityIcon = (sev: string) => {
    switch (sev) {
      case 'critical': return 'text-red-500'
      case 'high': case 'error': return 'text-orange-500'
      case 'warning': return 'text-yellow-500'
      default: return 'text-blue-500'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Active Alerts</h2>
          {alerts.length > 0 && (
            <span className="bg-orange-100 text-orange-700 text-xs font-medium px-1.5 py-0.5 rounded-full">
              {alerts.length}
            </span>
          )}
        </div>
        <Link to="/alerts" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-[180px] text-gray-400">
          <Bell className="w-8 h-8 mb-2 text-gray-300" />
          <p className="text-sm">No active alerts</p>
          <p className="text-xs mt-1">All quiet</p>
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              <AlertTriangle className={`w-4 h-4 mt-0.5 flex-shrink-0 ${severityIcon(alert.severity)}`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{alert.alertname}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {alert.service && <span className="text-xs text-gray-500">{alert.service}</span>}
                  <span className="text-xs text-gray-400">{timeAgo(alert.startsAt)}</span>
                  {alert.source === 'grafana' && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-orange-50 text-orange-600 font-medium flex items-center gap-0.5">
                      <BarChart3 className="w-2.5 h-2.5" /> Grafana
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                alert.severity === 'critical' ? 'bg-red-100 text-red-700' :
                alert.severity === 'high' || alert.severity === 'error' ? 'bg-orange-100 text-orange-700' :
                'bg-yellow-100 text-yellow-700'
              }`}>
                {alert.severity}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
