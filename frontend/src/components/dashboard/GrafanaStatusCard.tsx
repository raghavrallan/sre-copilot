import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ExternalLink, CheckCircle2, XCircle, Loader2, AlertTriangle, Activity, Bell, Zap } from 'lucide-react'
import api from '../../services/api'

export default function GrafanaStatusCard() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'none'>('loading')
  const [dashboardCount, setDashboardCount] = useState(0)
  const [grafanaName, setGrafanaName] = useState('')
  const [grafanaUrl, setGrafanaUrl] = useState('')
  const [firingAlerts, setFiringAlerts] = useState(0)
  const [totalRules, setTotalRules] = useState(0)

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await api.get('/api/v1/grafana/dashboards')
        const data = resp.data
        setDashboardCount(data.dashboards?.length || 0)
        setGrafanaName(data.grafana_name || 'Grafana')
        setGrafanaUrl(data.grafana_url || '')
        setStatus('connected')

        try {
          const alertResp = await api.get('/api/v1/grafana/alert-rules')
          setFiringAlerts(alertResp.data.firing || 0)
          setTotalRules(alertResp.data.total || 0)
        } catch { /* alert rules optional */ }
      } catch (err: any) {
        setStatus(err?.response?.status === 404 ? 'none' : 'error')
      }
    }
    check()
    const interval = setInterval(check, 60000)
    return () => clearInterval(interval)
  }, [])

  if (status === 'loading') {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-600" />
          </div>
          <h3 className="font-semibold text-gray-900">Grafana</h3>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  if (status === 'none') {
    return (
      <Link to="/settings?tab=monitoring" className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-gray-400" />
          </div>
          <h3 className="font-semibold text-gray-900">Grafana</h3>
        </div>
        <p className="text-sm text-gray-500">Not configured</p>
        <p className="text-xs text-blue-600 mt-2 group-hover:underline">Configure in Settings</p>
      </Link>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{grafanaName}</h3>
            {status === 'connected' ? (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-red-600">
                <XCircle className="w-3 h-3" /> Error
              </span>
            )}
          </div>
        </div>
      </div>

      {status === 'connected' && (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{dashboardCount}</p>
              <p className="text-[10px] text-gray-500">Dashboards</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{totalRules}</p>
              <p className="text-[10px] text-gray-500">Alert Rules</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${firingAlerts > 0 ? 'text-red-600' : 'text-green-600'}`}>{firingAlerts}</p>
              <p className="text-[10px] text-gray-500">Firing</p>
            </div>
          </div>

          {firingAlerts > 0 && (
            <Link to="/alerts" className="flex items-center gap-2 px-2.5 py-1.5 mb-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700 hover:bg-red-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
              {firingAlerts} alert{firingAlerts !== 1 ? 's' : ''} firing
            </Link>
          )}

          <div className="flex items-center gap-2">
            <Link to="/dashboards/grafana" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Activity className="w-3 h-3" /> Dashboards
            </Link>
            <Link to="/alerts" className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Bell className="w-3 h-3" /> Alerts
            </Link>
            {grafanaUrl && (
              <a href={grafanaUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 ml-auto">
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </>
      )}

      {status === 'error' && (
        <p className="text-sm text-gray-500 mt-2">Could not connect to Grafana</p>
      )}
    </div>
  )
}
