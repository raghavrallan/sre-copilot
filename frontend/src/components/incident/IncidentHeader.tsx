import { Incident } from '../../types/incident'
import { Link } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  Timer,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  Radio,
} from 'lucide-react'

const STATES = [
  { value: 'detected', label: 'Detected', color: 'bg-gray-500', bg: 'bg-gray-100', text: 'text-gray-800' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-blue-500', bg: 'bg-blue-100', text: 'text-blue-800' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-500', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500', bg: 'bg-green-100', text: 'text-green-800' },
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500', text: 'text-red-800', bg: 'bg-red-100' },
  { value: 'high', label: 'High', color: 'bg-orange-500', text: 'text-orange-800', bg: 'bg-orange-100' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500', text: 'text-yellow-800', bg: 'bg-yellow-100' },
  { value: 'low', label: 'Low', color: 'bg-blue-500', text: 'text-blue-800', bg: 'bg-blue-100' },
]

interface IncidentHeaderProps {
  incident: Incident
  isConnected: boolean
  onStateChange: () => void
  onSeverityChange: () => void
}

export default function IncidentHeader({
  incident,
  isConnected,
  onStateChange,
  onSeverityChange,
}: IncidentHeaderProps) {
  const stateConfig = STATES.find((s) => s.value === incident.state)
  const severityConfig = SEVERITIES.find((s) => s.value === incident.severity)

  const calculateTimeMetrics = () => {
    const detected = new Date(incident.detected_at)
    const now = new Date()
    const acknowledged = incident.acknowledged_at ? new Date(incident.acknowledged_at) : null
    const resolved = incident.resolved_at ? new Date(incident.resolved_at) : null

    const formatDuration = (ms: number) => {
      const seconds = Math.floor(ms / 1000)
      const minutes = Math.floor(seconds / 60)
      const hours = Math.floor(minutes / 60)
      const days = Math.floor(hours / 24)
      if (days > 0) return `${days}d ${hours % 24}h`
      if (hours > 0) return `${hours}h ${minutes % 60}m`
      if (minutes > 0) return `${minutes}m`
      return `${seconds}s`
    }

    return {
      detected: detected.toLocaleString(),
      duration: resolved
        ? formatDuration(resolved.getTime() - detected.getTime())
        : formatDuration(now.getTime() - detected.getTime()),
      timeToAcknowledge: acknowledged
        ? formatDuration(acknowledged.getTime() - detected.getTime())
        : null,
      timeToResolve: resolved
        ? formatDuration(resolved.getTime() - detected.getTime())
        : null,
    }
  }

  const metrics = calculateTimeMetrics()

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
      {/* Top row: Back + Title + Live indicator */}
      <div className="pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0">
            <Link
              to="/incidents"
              className="mt-1 p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 truncate">{incident.title}</h1>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-sm text-gray-500">{incident.service_name}</span>
                <span className="text-gray-300">|</span>
                <span className="text-xs text-gray-400">ID: {incident.id.slice(0, 8)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
              isConnected
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-500 border border-gray-200'
            }`}>
              <Radio className={`w-3 h-3 ${isConnected ? 'text-green-500' : 'text-gray-400'}`} />
              {isConnected ? 'Live' : 'Offline'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Badges + Time metrics */}
      <div className="pb-3 flex flex-wrap items-center gap-3">
        <button
          onClick={onStateChange}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all hover:shadow-sm ${stateConfig?.bg} ${stateConfig?.text} border-transparent hover:border-gray-300`}
        >
          <span className={`w-2 h-2 rounded-full ${stateConfig?.color} ${incident.state === 'investigating' ? 'animate-pulse' : ''}`} />
          {stateConfig?.label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>

        <button
          onClick={onSeverityChange}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border transition-all hover:shadow-sm ${severityConfig?.bg} ${severityConfig?.text} border-transparent hover:border-gray-300`}
        >
          {incident.severity === 'critical' && <AlertTriangle className="w-3 h-3" />}
          {severityConfig?.label}
          <ChevronDown className="w-3 h-3 opacity-50" />
        </button>

        <div className="h-5 w-px bg-gray-200 hidden sm:block" />

        <div className="flex items-center gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Detected {metrics.detected}</span>
          </div>
          <div className="flex items-center gap-1">
            <Timer className="w-3.5 h-3.5" />
            <span className="font-semibold text-gray-700">{metrics.duration}</span>
            <span>{incident.state === 'resolved' ? 'total' : 'ongoing'}</span>
          </div>
          {metrics.timeToAcknowledge && (
            <div className="flex items-center gap-1 hidden md:flex">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
              <span>TTA {metrics.timeToAcknowledge}</span>
            </div>
          )}
          {metrics.timeToResolve && (
            <div className="flex items-center gap-1 hidden md:flex">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              <span>TTR {metrics.timeToResolve}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
