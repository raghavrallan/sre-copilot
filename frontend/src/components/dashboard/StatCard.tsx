import { type LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  color: 'blue' | 'red' | 'yellow' | 'green' | 'purple' | 'orange'
  subtitle?: string
  trend?: { value: number; label: string }
  loading?: boolean
}

const colorMap = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', iconBg: 'bg-blue-100', value: 'text-blue-700' },
  red: { bg: 'bg-red-50', icon: 'text-red-600', iconBg: 'bg-red-100', value: 'text-red-700' },
  yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', iconBg: 'bg-yellow-100', value: 'text-yellow-700' },
  green: { bg: 'bg-green-50', icon: 'text-green-600', iconBg: 'bg-green-100', value: 'text-green-700' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600', iconBg: 'bg-purple-100', value: 'text-purple-700' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600', iconBg: 'bg-orange-100', value: 'text-orange-700' },
}

export default function StatCard({ title, value, icon: Icon, color, subtitle, trend, loading }: StatCardProps) {
  const colors = colorMap[color]

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-gray-200 rounded w-20" />
            <div className="h-7 bg-gray-200 rounded w-16" />
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-4`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{title}</p>
          <p className={`text-2xl font-bold mt-1 ${colors.value}`}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {subtitle && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center mt-1">
              <span className={`text-xs font-medium ${trend.value >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-gray-400 ml-1">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-2.5 ${colors.iconBg} rounded-lg flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
      </div>
    </div>
  )
}
