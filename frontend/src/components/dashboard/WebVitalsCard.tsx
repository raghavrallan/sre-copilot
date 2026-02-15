import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Globe, ArrowRight } from 'lucide-react'
import api from '../../services/api'

interface WebVitals {
  lcp: number
  fid: number
  cls: number
  fcp: number
  pageLoads: number
  jsErrors: number
}

function vitalRating(metric: string, value: number): { label: string; color: string; bg: string } {
  switch (metric) {
    case 'lcp':
      if (value <= 2500) return { label: 'Good', color: 'text-green-700', bg: 'bg-green-500' }
      if (value <= 4000) return { label: 'Needs Work', color: 'text-yellow-700', bg: 'bg-yellow-500' }
      return { label: 'Poor', color: 'text-red-700', bg: 'bg-red-500' }
    case 'fid':
      if (value <= 100) return { label: 'Good', color: 'text-green-700', bg: 'bg-green-500' }
      if (value <= 300) return { label: 'Needs Work', color: 'text-yellow-700', bg: 'bg-yellow-500' }
      return { label: 'Poor', color: 'text-red-700', bg: 'bg-red-500' }
    case 'cls':
      if (value <= 0.1) return { label: 'Good', color: 'text-green-700', bg: 'bg-green-500' }
      if (value <= 0.25) return { label: 'Needs Work', color: 'text-yellow-700', bg: 'bg-yellow-500' }
      return { label: 'Poor', color: 'text-red-700', bg: 'bg-red-500' }
    default:
      return { label: 'N/A', color: 'text-gray-500', bg: 'bg-gray-400' }
  }
}

function formatVital(metric: string, value: number): string {
  if (metric === 'cls') return value.toFixed(3)
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}

export default function WebVitalsCard() {
  const [vitals, setVitals] = useState<WebVitals | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      try {
        const { data } = await api.get('/api/v1/browser/overview')
        const wv = data.web_vitals || {}
        setVitals({
          lcp: wv.LCP?.avg ?? wv.lcp?.avg ?? 0,
          fid: wv.FID?.avg ?? wv.fid?.avg ?? 0,
          cls: wv.CLS?.avg ?? wv.cls?.avg ?? 0,
          fcp: wv.FCP?.avg ?? wv.fcp?.avg ?? 0,
          pageLoads: data.page_loads_total ?? 0,
          jsErrors: data.js_errors_total ?? 0,
        })
      } catch {
        setVitals(null)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  const metrics = vitals ? [
    { key: 'lcp', label: 'LCP', value: vitals.lcp },
    { key: 'fid', label: 'FID', value: vitals.fid },
    { key: 'cls', label: 'CLS', value: vitals.cls },
  ] : []

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-500" />
          <h2 className="text-base font-semibold text-gray-900">Web Vitals</h2>
        </div>
        <Link to="/browser" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          Details <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      ) : !vitals ? (
        <div className="flex flex-col items-center justify-center h-[160px] text-gray-400">
          <Globe className="w-8 h-8 mb-2 text-gray-300" />
          <p className="text-sm">No browser data</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {metrics.map(m => {
              const rating = vitalRating(m.key, m.value)
              const maxVal = m.key === 'lcp' ? 5000 : m.key === 'fid' ? 400 : 0.4
              const pct = Math.min((m.value / maxVal) * 100, 100)
              return (
                <div key={m.key}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700">{m.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="tabular-nums text-gray-900 font-medium">{formatVital(m.key, m.value)}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${rating.color} bg-opacity-10 font-medium`}>
                        {rating.label}
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${rating.bg} transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{vitals.pageLoads.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Page Loads</p>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${vitals.jsErrors > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                {vitals.jsErrors.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500">JS Errors</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-gray-900">{formatVital('fcp', vitals.fcp)}</p>
              <p className="text-xs text-gray-500">FCP</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
