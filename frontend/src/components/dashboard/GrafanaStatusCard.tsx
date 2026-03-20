import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { BarChart3, ExternalLink, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import api from '../../services/api'

export default function GrafanaStatusCard() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'error' | 'none'>('loading')
  const [dashboardCount, setDashboardCount] = useState(0)
  const [grafanaName, setGrafanaName] = useState('')
  const [grafanaUrl, setGrafanaUrl] = useState('')

  useEffect(() => {
    const check = async () => {
      try {
        const resp = await api.get('/api/v1/grafana/dashboards')
        const data = resp.data
        setDashboardCount(data.dashboards?.length || 0)
        setGrafanaName(data.grafana_name || 'Grafana')
        setGrafanaUrl(data.grafana_url || '')
        setStatus('connected')
      } catch (err: any) {
        const code = err?.response?.status
        if (code === 404) {
          setStatus('none')
        } else {
          setStatus('error')
        }
      }
    }
    check()
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
      <Link
        to="/settings?tab=monitoring"
        className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group"
      >
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
          <p className="text-2xl font-bold text-gray-900 mb-1">{dashboardCount}</p>
          <p className="text-sm text-gray-500 mb-3">dashboard{dashboardCount !== 1 ? 's' : ''} available</p>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboards/grafana"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View Dashboards
            </Link>
            {grafanaUrl && (
              <a
                href={grafanaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
              >
                <ExternalLink className="w-3 h-3" />
                Open
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
