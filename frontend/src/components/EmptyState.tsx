import React from 'react'
import { Activity } from 'lucide-react'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, actionLabel, actionHref }) => (
  <div className="flex flex-col items-center justify-center py-16 px-4">
    <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4 text-gray-400">
      {icon || <Activity size={32} />}
    </div>
    <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
    <p className="text-gray-400 text-center max-w-md mb-6">{description}</p>
    {actionLabel && actionHref && (
      <a href={actionHref} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
        {actionLabel}
      </a>
    )}
  </div>
)

export default EmptyState
