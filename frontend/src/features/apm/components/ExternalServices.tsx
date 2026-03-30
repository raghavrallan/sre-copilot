import { CheckCircle, XCircle, AlertCircle } from 'lucide-react'

export interface ExternalService {
  id: string
  service: string
  avgDuration: number
  callsPerMin: number
  errorRate: number
  status: 'healthy' | 'degraded' | 'error'
}

interface ExternalServicesProps {
  services: ExternalService[]
}

const getStatusIndicator = (status: ExternalService['status']) => {
  switch (status) {
    case 'healthy':
      return <CheckCircle className="w-5 h-5 text-green-500" />
    case 'degraded':
      return <AlertCircle className="w-5 h-5 text-yellow-500" />
    case 'error':
      return <XCircle className="w-5 h-5 text-red-500" />
    default:
      return <AlertCircle className="w-5 h-5 text-gray-500" />
  }
}

const getStatusBadge = (status: ExternalService['status']) => {
  switch (status) {
    case 'healthy':
      return 'bg-green-900/50 text-green-400 border-green-600/50'
    case 'degraded':
      return 'bg-yellow-900/50 text-yellow-400 border-yellow-600/50'
    case 'error':
      return 'bg-red-900/50 text-red-400 border-red-600/50'
    default:
      return 'bg-gray-700/50 text-gray-400 border-gray-600/50'
  }
}

export default function ExternalServices({ services }: ExternalServicesProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-700/50 shadow-sm bg-gray-800/50">
      <table className="min-w-full divide-y divide-gray-700/50">
        <thead className="bg-gray-900/80">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Service
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Avg Duration
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Calls/min
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Error Rate
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700/50 bg-gray-800/30">
          {services.map((svc) => (
            <tr key={svc.id} className="hover:bg-gray-700/50">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  {getStatusIndicator(svc.status)}
                  <span
                    className={`px-2 py-1 text-xs font-semibold rounded border ${getStatusBadge(
                      svc.status
                    )}`}
                  >
                    {svc.status}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 text-sm font-medium text-white">
                {svc.service}
              </td>
              <td className="px-6 py-4 text-sm text-gray-300">
                {svc.avgDuration.toFixed(0)}ms
              </td>
              <td className="px-6 py-4 text-sm text-gray-300">
                {svc.callsPerMin.toFixed(1)}
              </td>
              <td className="px-6 py-4">
                <span
                  className={
                    svc.errorRate > 5 ? 'text-red-400' : svc.errorRate > 1 ? 'text-yellow-400' : 'text-gray-300'
                  }
                >
                  {svc.errorRate.toFixed(2)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
