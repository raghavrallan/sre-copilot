import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import { Incident, Hypothesis } from '../types/incident'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useAuthStore } from '../lib/stores/auth-store'
import MetricsPanel from '../components/workflow/MetricsPanel'
import WorkflowTimeline from '../components/workflow/WorkflowTimeline'
import toast from 'react-hot-toast'

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

const STATES = [
  { value: 'detected', label: 'Detected', color: 'bg-gray-500' },
  { value: 'acknowledged', label: 'Acknowledged', color: 'bg-blue-500' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-500' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' }
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500', textColor: 'text-red-800', bgColor: 'bg-red-100' },
  { value: 'high', label: 'High', color: 'bg-orange-500', textColor: 'text-orange-800', bgColor: 'bg-orange-100' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500', textColor: 'text-yellow-800', bgColor: 'bg-yellow-100' },
  { value: 'low', label: 'Low', color: 'bg-blue-500', textColor: 'text-blue-800', bgColor: 'bg-blue-100' }
]

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, currentProject } = useAuthStore()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [showStateModal, setShowStateModal] = useState(false)
  const [showSeverityModal, setShowSeverityModal] = useState(false)
  const [selectedState, setSelectedState] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('')
  const [comment, setComment] = useState('')
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { isConnected } = useWebSocket()

  useEffect(() => {
    if (id) {
      fetchIncidentData()
    }
  }, [id])

  const fetchIncidentData = async () => {
    try {
      setLoading(true)
      const [incidentResponse, hypothesesResponse, activitiesResponse] = await Promise.all([
        api.get(`/api/v1/incidents/${id}?project_id=${currentProject?.id}`),
        api.get(`/api/v1/incidents/${id}/hypotheses?project_id=${currentProject?.id}`),
        api.get(`/api/v1/incidents/${id}/activities?project_id=${currentProject?.id}`)
      ])
      setIncident(incidentResponse.data)
      setHypotheses(hypothesesResponse.data)
      setActivities(activitiesResponse.data)
    } catch (error) {
      console.error('Failed to fetch incident details:', error)
    } finally {
      setLoading(false)
    }
  }

  // Real-time updates
  useWebSocketEvent<Incident>('incident.updated', (updatedIncident: Incident) => {
    if (updatedIncident.id === id) {
      setIncident(updatedIncident)
    }
  }, [id])

  useWebSocketEvent<Hypothesis>('hypothesis.generated', (newHypothesis: Hypothesis) => {
    if (newHypothesis.incident_id === id) {
      setHypotheses((prev) => {
        const exists = prev.some(h => h.id === newHypothesis.id)
        if (exists) {
          return prev.map(h => h.id === newHypothesis.id ? newHypothesis : h)
        }
        return [...prev, newHypothesis].sort((a, b) => a.rank - b.rank)
      })
    }
  }, [id])

  const handleStateChange = async () => {
    if (!selectedState || submitting) return

    setSubmitting(true)
    try {
      await api.patch(`/api/v1/incidents/${id}/state?project_id=${currentProject?.id}`, {
        state: selectedState,
        comment: comment || null,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email
      })
      toast.success(`Status changed to ${selectedState}`)
      setShowStateModal(false)
      setComment('')
      setSelectedState('')
      fetchIncidentData()
    } catch (error) {
      console.error('Failed to update state:', error)
      toast.error('Failed to update status')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSeverityChange = async () => {
    if (!selectedSeverity || submitting) return

    setSubmitting(true)
    try {
      await api.patch(`/api/v1/incidents/${id}/severity?project_id=${currentProject?.id}`, {
        severity: selectedSeverity,
        comment: comment || null,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email
      })
      toast.success(`Severity changed to ${selectedSeverity}`)
      setShowSeverityModal(false)
      setComment('')
      setSelectedSeverity('')
      fetchIncidentData()
    } catch (error) {
      console.error('Failed to update severity:', error)
      toast.error('Failed to update severity')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim() || submitting) return

    setSubmitting(true)
    try {
      await api.post(`/api/v1/incidents/${id}/comments?project_id=${currentProject?.id}`, {
        content: newComment,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email
      })
      toast.success('Comment added')
      setNewComment('')
      fetchIncidentData()
    } catch (error) {
      console.error('Failed to add comment:', error)
      toast.error('Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'state_change':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        )
      case 'severity_change':
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      default:
        return (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )
    }
  }

  const calculateTimeMetrics = () => {
    if (!incident) return null

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
      timeToAcknowledge: acknowledged ? formatDuration(acknowledged.getTime() - detected.getTime()) : null,
      timeToResolve: resolved ? formatDuration(resolved.getTime() - detected.getTime()) : null,
      duration: resolved
        ? formatDuration(resolved.getTime() - detected.getTime())
        : formatDuration(now.getTime() - detected.getTime())
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!incident) {
    return <div className="text-center py-8">Incident not found</div>
  }

  const timeMetrics = calculateTimeMetrics()
  const currentStateConfig = STATES.find(s => s.value === incident.state)
  const currentSeverityConfig = SEVERITIES.find(s => s.value === incident.severity)

  return (
    <div className="px-4 sm:px-0 space-y-6">
      {/* Back Link */}
      <Link to="/incidents" className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Incidents
      </Link>

      {/* Header Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900">{incident.title}</h1>
            <p className="text-sm text-gray-600 mt-1">Service: {incident.service_name}</p>
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="flex items-center text-xs text-green-600 mr-2">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                Live
              </span>
            )}
          </div>
        </div>

        {/* Status and Severity Badges */}
        <div className="flex flex-wrap gap-3 mb-6">
          {/* State Badge - Clickable */}
          <button
            onClick={() => {
              setSelectedState(incident.state)
              setShowStateModal(true)
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border-2 border-transparent hover:border-gray-300 transition-all ${
              incident.state === 'resolved' ? 'bg-green-100 text-green-800' :
              incident.state === 'investigating' ? 'bg-yellow-100 text-yellow-800' :
              incident.state === 'acknowledged' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${currentStateConfig?.color}`} />
              {currentStateConfig?.label || incident.state}
              <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>

          {/* Severity Badge - Clickable */}
          <button
            onClick={() => {
              setSelectedSeverity(incident.severity)
              setShowSeverityModal(true)
            }}
            className={`px-4 py-2 text-sm font-semibold rounded-lg border-2 border-transparent hover:border-gray-300 transition-all ${currentSeverityConfig?.bgColor} ${currentSeverityConfig?.textColor}`}
          >
            <span className="flex items-center gap-2">
              {currentSeverityConfig?.label || incident.severity}
              <svg className="w-3 h-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </span>
          </button>
        </div>

        {/* Time Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
          <div>
            <span className="text-xs font-medium text-gray-500 block">Detected</span>
            <p className="text-sm text-gray-900">{new Date(incident.detected_at).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 block">Duration</span>
            <p className="text-sm text-gray-900 font-semibold">{timeMetrics?.duration || '-'}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 block">Time to Acknowledge</span>
            <p className="text-sm text-gray-900">{timeMetrics?.timeToAcknowledge || '-'}</p>
          </div>
          <div>
            <span className="text-xs font-medium text-gray-500 block">Time to Resolve</span>
            <p className="text-sm text-gray-900">{timeMetrics?.timeToResolve || '-'}</p>
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Description</h2>
          <p className="text-gray-600 text-sm whitespace-pre-wrap">{incident.description || 'No description provided'}</p>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Hypotheses */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Hypotheses */}
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span>🤖</span> AI-Generated Hypotheses
              </h2>
            </div>

            {hypotheses.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="mb-2">Generating hypotheses...</div>
                {isConnected && (
                  <div className="text-xs text-green-600">
                    ✓ Real-time updates enabled
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {hypotheses.map((hypothesis) => (
                  <div key={hypothesis.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-500">#{hypothesis.rank}</span>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                          {(hypothesis.confidence_score * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{hypothesis.claim}</h3>
                    <p className="text-sm text-gray-600 mb-3">{hypothesis.description}</p>
                    {hypothesis.supporting_evidence.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Evidence:</p>
                        <ul className="list-disc list-inside space-y-1">
                          {hypothesis.supporting_evidence.map((evidence, idx) => (
                            <li key={idx} className="text-xs text-gray-600">{evidence}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Workflow Timeline */}
          <WorkflowTimeline incidentId={id!} />

          {/* AI Cost Metrics */}
          <MetricsPanel incidentId={id!} />
        </div>

        {/* Right Column - Activity */}
        <div className="space-y-6">
          {/* Add Comment */}
          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Add Comment</h3>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <button
              onClick={handleAddComment}
              disabled={!newComment.trim() || submitting}
              className="mt-2 w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Comment'}
            </button>
          </div>

          {/* Activity Timeline */}
          <div className="bg-white shadow rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Activity Timeline</h3>
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No activity yet</p>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {activities.map((activity) => (
                  <div key={activity.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      activity.activity_type === 'state_change' ? 'bg-blue-100 text-blue-600' :
                      activity.activity_type === 'severity_change' ? 'bg-orange-100 text-orange-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-900">{activity.user_name}</span>
                        <span className="text-xs text-gray-400">
                          {new Date(activity.created_at).toLocaleString()}
                        </span>
                      </div>
                      {activity.activity_type === 'state_change' && (
                        <div className="text-xs text-gray-600 mb-1">
                          Changed state: <span className="font-medium">{activity.old_value}</span> → <span className="font-medium">{activity.new_value}</span>
                        </div>
                      )}
                      {activity.activity_type === 'severity_change' && (
                        <div className="text-xs text-gray-600 mb-1">
                          Changed severity: <span className="font-medium">{activity.old_value}</span> → <span className="font-medium">{activity.new_value}</span>
                        </div>
                      )}
                      <p className="text-sm text-gray-600">{activity.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* State Change Modal */}
      {showStateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h3>
            <div className="space-y-3 mb-4">
              {STATES.map((state) => (
                <label
                  key={state.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedState === state.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="state"
                    value={state.value}
                    checked={selectedState === state.value}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="sr-only"
                  />
                  <span className={`w-3 h-3 rounded-full ${state.color}`} />
                  <span className="font-medium text-gray-900">{state.label}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a reason for this change..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowStateModal(false)
                  setComment('')
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleStateChange}
                disabled={submitting || selectedState === incident.state}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Severity Change Modal */}
      {showSeverityModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Severity</h3>
            <div className="space-y-3 mb-4">
              {SEVERITIES.map((severity) => (
                <label
                  key={severity.value}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedSeverity === severity.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={severity.value}
                    checked={selectedSeverity === severity.value}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="sr-only"
                  />
                  <span className={`w-3 h-3 rounded-full ${severity.color}`} />
                  <span className="font-medium text-gray-900">{severity.label}</span>
                </label>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Add a reason for this change..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowSeverityModal(false)
                  setComment('')
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleSeverityChange}
                disabled={submitting || selectedSeverity === incident.severity}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Updating...' : 'Update Severity'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
