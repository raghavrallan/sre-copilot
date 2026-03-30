import { useState } from 'react'
import {
  MessageSquare,
  ArrowRight,
  AlertTriangle,
  Send,
  Loader2,
  Clock,
} from 'lucide-react'

interface Activity {
  id: string
  incident_id: string
  activity_type: string
  content: string
  old_value?: string
  new_value?: string
  user_id?: string
  user_name: string
  user_email: string
  created_at: string
}

interface ActivityPanelProps {
  activities: Activity[]
  onAddComment: (comment: string) => Promise<void>
  submitting: boolean
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

function getActivityIcon(type: string) {
  switch (type) {
    case 'state_change':
      return (
        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
          <ArrowRight className="w-4 h-4" />
        </div>
      )
    case 'severity_change':
      return (
        <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-4 h-4" />
        </div>
      )
    default:
      return (
        <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center flex-shrink-0">
          <MessageSquare className="w-4 h-4" />
        </div>
      )
  }
}

function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
}

export default function ActivityPanel({ activities, onAddComment, submitting }: ActivityPanelProps) {
  const [newComment, setNewComment] = useState('')

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return
    await onAddComment(newComment.trim())
    setNewComment('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSubmit()
    }
  }

  return (
    <div className="space-y-6">
      {/* Comment input */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-500" />
          Add Comment
        </h3>
        <div className="relative">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write a comment... (Ctrl+Enter to submit)"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-gray-50 hover:bg-white transition-colors"
            rows={3}
          />
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="absolute bottom-3 right-3 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500" />
          Activity Timeline
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">{activities.length}</span>
        </h3>

        {activities.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No activity yet</p>
            <p className="text-xs text-gray-400">Be the first to add a comment</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-4 top-4 bottom-4 w-px bg-gray-200" />
            <div className="space-y-1">
              {activities.map((activity) => (
                <div key={activity.id} className="relative pl-12 py-3">
                  <div className="absolute left-0">{getActivityIcon(activity.activity_type)}</div>
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                        <span className="text-[8px] font-bold text-white">{getInitials(activity.user_name)}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">{activity.user_name}</span>
                      <span className="text-xs text-gray-400">{timeAgo(activity.created_at)}</span>
                    </div>
                    {activity.activity_type === 'state_change' && (
                      <div className="flex items-center gap-1.5 text-xs mb-1">
                        <span className="text-gray-500">Changed state:</span>
                        <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{activity.old_value}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{activity.new_value}</span>
                      </div>
                    )}
                    {activity.activity_type === 'severity_change' && (
                      <div className="flex items-center gap-1.5 text-xs mb-1">
                        <span className="text-gray-500">Changed severity:</span>
                        <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{activity.old_value}</span>
                        <ArrowRight className="w-3 h-3 text-gray-400" />
                        <span className="font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">{activity.new_value}</span>
                      </div>
                    )}
                    {activity.content && <p className="text-sm text-gray-600 leading-relaxed">{activity.content}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
