import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import api from '../services/api'
import { Incident, Hypothesis } from '../types/incident'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'
import { useWebSocket } from '../contexts/WebSocketContext'
import { useAuthStore } from '../lib/stores/auth-store'
import toast from 'react-hot-toast'
import {
  LayoutDashboard,
  Activity,
  Workflow,
  Coins,
  MessageSquare,
} from 'lucide-react'

// New modular components
import IncidentHeader from '../components/incident/IncidentHeader'
import HypothesesPanel from '../components/incident/HypothesesPanel'
import PrometheusMetrics from '../components/incident/PrometheusMetrics'
import WorkflowPipeline from '../components/incident/WorkflowPipeline'
import AICostAnalytics from '../components/incident/AICostAnalytics'
import ActivityPanel from '../components/incident/ActivityPanel'

interface ActivityItem {
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
  { value: 'resolved', label: 'Resolved', color: 'bg-green-500' },
]

const SEVERITIES = [
  { value: 'critical', label: 'Critical', color: 'bg-red-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-500' },
  { value: 'low', label: 'Low', color: 'bg-blue-500' },
]

type TabId = 'overview' | 'prometheus' | 'pipeline' | 'costs' | 'activity'

interface TabDef {
  id: TabId
  label: string
  icon: React.ElementType
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'prometheus', label: 'Prometheus', icon: Activity },
  { id: 'pipeline', label: 'Pipeline', icon: Workflow },
  { id: 'costs', label: 'AI Costs', icon: Coins },
  { id: 'activity', label: 'Activity', icon: MessageSquare },
]

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user, currentProject } = useAuthStore()
  const { isConnected } = useWebSocket()

  const [incident, setIncident] = useState<Incident | null>(null)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  // Modal state
  const [showStateModal, setShowStateModal] = useState(false)
  const [showSeverityModal, setShowSeverityModal] = useState(false)
  const [selectedState, setSelectedState] = useState('')
  const [selectedSeverity, setSelectedSeverity] = useState('')
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (id) fetchIncidentData()
  }, [id])

  const fetchIncidentData = async () => {
    try {
      setLoading(true)
      const [incidentRes, hypothesesRes, activitiesRes] = await Promise.all([
        api.get(`/api/v1/incidents/${id}?project_id=${currentProject?.id}`),
        api.get(`/api/v1/incidents/${id}/hypotheses?project_id=${currentProject?.id}`),
        api.get(`/api/v1/incidents/${id}/activities?project_id=${currentProject?.id}`),
      ])
      setIncident(incidentRes.data)
      setHypotheses(hypothesesRes.data)
      setActivities(activitiesRes.data)
    } catch (error) {
      console.error('Failed to fetch incident details:', error)
    } finally {
      setLoading(false)
    }
  }

  // Real-time updates
  useWebSocketEvent<Incident>('incident.updated', (updatedIncident: Incident) => {
    if (updatedIncident.id === id) setIncident(updatedIncident)
  }, [id])

  useWebSocketEvent<Hypothesis>('hypothesis.generated', (newHyp: Hypothesis) => {
    if (newHyp.incident_id === id) {
      setHypotheses((prev) => {
        const exists = prev.some((h) => h.id === newHyp.id)
        if (exists) return prev.map((h) => (h.id === newHyp.id ? newHyp : h))
        return [...prev, newHyp].sort((a, b) => a.rank - b.rank)
      })
    }
  }, [id])

  // Handlers
  const handleStateChange = async () => {
    if (!selectedState || submitting) return
    setSubmitting(true)
    try {
      await api.patch(`/api/v1/incidents/${id}/state?project_id=${currentProject?.id}`, {
        state: selectedState,
        comment: comment || null,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email,
      })
      toast.success(`Status changed to ${selectedState}`)
      setShowStateModal(false)
      setComment('')
      setSelectedState('')
      fetchIncidentData()
    } catch {
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
        user_email: user?.email,
      })
      toast.success(`Severity changed to ${selectedSeverity}`)
      setShowSeverityModal(false)
      setComment('')
      setSelectedSeverity('')
      fetchIncidentData()
    } catch {
      toast.error('Failed to update severity')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddComment = async (text: string) => {
    setSubmitting(true)
    try {
      await api.post(`/api/v1/incidents/${id}/comments?project_id=${currentProject?.id}`, {
        content: text,
        user_id: user?.id,
        user_name: user?.full_name,
        user_email: user?.email,
      })
      toast.success('Comment added')
      fetchIncidentData()
    } catch {
      toast.error('Failed to add comment')
    } finally {
      setSubmitting(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading incident...</p>
        </div>
      </div>
    )
  }

  if (!incident) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500">Incident not found</p>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {/* Sticky Header */}
      <IncidentHeader
        incident={incident}
        isConnected={isConnected}
        onStateChange={() => {
          setSelectedState(incident.state)
          setShowStateModal(true)
        }}
        onSeverityChange={() => {
          setSelectedSeverity(incident.severity)
          setShowSeverityModal(true)
        }}
      />

      {/* Tab Bar */}
      <div className="border-b border-gray-200 mt-4">
        <nav className="flex gap-0 overflow-x-auto" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.id === 'activity' && activities.length > 0 && (
                  <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                    {activities.length}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6 px-4 sm:px-0">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                {incident.description || 'No description provided'}
              </p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <HypothesesPanel hypotheses={hypotheses} isConnected={isConnected} />
              </div>
              <div>
                <ActivityPanel
                  activities={activities}
                  onAddComment={handleAddComment}
                  submitting={submitting}
                />
              </div>
            </div>
          </div>
        )}

        {/* Prometheus Tab */}
        {activeTab === 'prometheus' && (
          <PrometheusMetrics serviceName={incident.service_name} />
        )}

        {/* Pipeline Tab */}
        {activeTab === 'pipeline' && (
          <WorkflowPipeline incidentId={id!} />
        )}

        {/* AI Costs Tab */}
        {activeTab === 'costs' && (
          <AICostAnalytics incidentId={id!} />
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <ActivityPanel
            activities={activities}
            onAddComment={handleAddComment}
            submitting={submitting}
          />
        )}
      </div>

      {/* State Change Modal */}
      {showStateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Status</h3>
            <div className="space-y-2 mb-4">
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
                  <span className="font-medium text-gray-900 text-sm">{state.label}</span>
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
                onClick={() => { setShowStateModal(false); setComment('') }}
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Change Severity</h3>
            <div className="space-y-2 mb-4">
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
                  <span className="font-medium text-gray-900 text-sm">{severity.label}</span>
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
                onClick={() => { setShowSeverityModal(false); setComment('') }}
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
