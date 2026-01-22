import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import { Incident, Hypothesis } from '../types/incident'
import { useWebSocketEvent } from '../hooks/useWebSocketEvent'
import { useWebSocket } from '../contexts/WebSocketContext'

export default function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [incident, setIncident] = useState<Incident | null>(null)
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>([])
  const [loading, setLoading] = useState(true)
  const { isConnected } = useWebSocket()

  useEffect(() => {
    const fetchIncidentAndHypotheses = async () => {
      try {
        const [incidentResponse, hypothesesResponse] = await Promise.all([
          api.get(`/api/v1/incidents/${id}`),
          api.get(`/api/v1/incidents/${id}/hypotheses`),
        ])
        setIncident(incidentResponse.data)
        setHypotheses(hypothesesResponse.data)
      } catch (error) {
        console.error('Failed to fetch incident details:', error)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchIncidentAndHypotheses()
    }
  }, [id])

  // Real-time updates for incident state changes
  useWebSocketEvent<Incident>('incident.updated', (updatedIncident: Incident) => {
    if (updatedIncident.id === id) {
      setIncident(updatedIncident)
    }
  }, [id])

  // Real-time updates for new hypotheses
  useWebSocketEvent<Hypothesis>('hypothesis.generated', (newHypothesis: Hypothesis) => {
    if (newHypothesis.incident_id === id) {
      setHypotheses((prev) => {
        // Check if hypothesis already exists
        const exists = prev.some(h => h.id === newHypothesis.id)
        if (exists) {
          return prev.map(h => h.id === newHypothesis.id ? newHypothesis : h)
        }
        // Add new hypothesis and sort by rank
        return [...prev, newHypothesis].sort((a, b) => a.rank - b.rank)
      })
    }
  }, [id])

  if (loading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!incident) {
    return <div className="text-center py-8">Incident not found</div>
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-6">
        <Link to="/incidents" className="text-blue-600 hover:text-blue-800 text-sm">
          ← Back to Incidents
        </Link>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{incident.title}</h1>
            <p className="text-sm text-gray-600 mt-1">Service: {incident.service_name}</p>
          </div>
          <div className="flex space-x-2">
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${
                incident.severity === 'critical'
                  ? 'bg-red-100 text-red-800'
                  : incident.severity === 'high'
                  ? 'bg-orange-100 text-orange-800'
                  : incident.severity === 'medium'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-blue-100 text-blue-800'
              }`}
            >
              {incident.severity}
            </span>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${
                incident.state === 'resolved'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {incident.state}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Description</h2>
          <p className="text-gray-700">{incident.description || 'No description provided'}</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium text-gray-500">Detected At:</span>
            <p className="text-sm text-gray-900">
              {new Date(incident.detected_at).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-sm font-medium text-gray-500">Created At:</span>
            <p className="text-sm text-gray-900">
              {new Date(incident.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900">
            🤖 AI-Generated Hypotheses
          </h2>
          {isConnected && (
            <div className="flex items-center text-sm text-green-600">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Live Updates
            </div>
          )}
        </div>

        {hypotheses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="mb-2">Generating hypotheses... This may take a few moments.</div>
            {isConnected && (
              <div className="text-xs text-green-600">
                ✓ Real-time updates enabled - hypotheses will appear automatically
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {hypotheses.map((hypothesis) => (
              <div key={hypothesis.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    <span className="text-sm font-semibold text-gray-500 mr-2">
                      #{hypothesis.rank}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      Confidence: {(hypothesis.confidence_score * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {hypothesis.claim}
                </h3>
                <p className="text-sm text-gray-700 mb-3">{hypothesis.description}</p>

                {hypothesis.supporting_evidence.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-1">Supporting Evidence:</p>
                    <ul className="list-disc list-inside space-y-1">
                      {hypothesis.supporting_evidence.map((evidence, idx) => (
                        <li key={idx} className="text-sm text-gray-600">
                          {evidence}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
