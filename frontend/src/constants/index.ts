export const SEVERITY_COLORS: Record<string, { bg: string; text: string; dot: string; border: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500', border: 'border-red-200' },
  high:     { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500', border: 'border-orange-200' },
  medium:   { bg: 'bg-yellow-50', text: 'text-yellow-700', dot: 'bg-yellow-500', border: 'border-yellow-200' },
  low:      { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500', border: 'border-blue-200' },
  info:     { bg: 'bg-gray-50', text: 'text-gray-700', dot: 'bg-gray-500', border: 'border-gray-200' },
}

export const INCIDENT_STATES: Record<string, { label: string; bg: string; text: string }> = {
  detected:       { label: 'Detected', bg: 'bg-red-50', text: 'text-red-700' },
  acknowledged:   { label: 'Acknowledged', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  investigating:  { label: 'Investigating', bg: 'bg-blue-50', text: 'text-blue-700' },
  resolved:       { label: 'Resolved', bg: 'bg-green-50', text: 'text-green-700' },
}

export const DEPLOYMENT_STATUSES: Record<string, { label: string; bg: string; text: string; border: string }> = {
  success:     { label: 'Success', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  failed:      { label: 'Failed', bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  in_progress: { label: 'In Progress', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  rolled_back: { label: 'Rolled Back', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
}

export const TIME_RANGES = [
  { label: 'Last 15m', value: '15m', seconds: 900 },
  { label: 'Last 1h', value: '1h', seconds: 3600 },
  { label: 'Last 6h', value: '6h', seconds: 21600 },
  { label: 'Last 24h', value: '24h', seconds: 86400 },
  { label: 'Last 7d', value: '7d', seconds: 604800 },
  { label: 'Last 30d', value: '30d', seconds: 2592000 },
] as const

export const ALERT_STATUSES: Record<string, { label: string; bg: string; text: string }> = {
  firing:       { label: 'Firing', bg: 'bg-red-50', text: 'text-red-700' },
  resolved:     { label: 'Resolved', bg: 'bg-green-50', text: 'text-green-700' },
  acknowledged: { label: 'Acknowledged', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  pending:      { label: 'Pending', bg: 'bg-gray-50', text: 'text-gray-700' },
}
