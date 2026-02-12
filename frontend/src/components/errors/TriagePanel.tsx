import { useState } from 'react'
import { Save } from 'lucide-react'

export interface ErrorGroup {
  fingerprint: string
  errorClass: string
  normalizedMessage: string
  status: 'unresolved' | 'investigating' | 'resolved' | 'ignored'
  assignee?: string
  notes?: string
}

interface TriagePanelProps {
  errorGroup: ErrorGroup
  onUpdate: (updates: Partial<ErrorGroup>) => void
}

const STATUS_OPTIONS = [
  { value: 'unresolved', label: 'Unresolved', color: 'bg-red-900/60 text-red-300', dotColor: 'bg-red-400' },
  { value: 'investigating', label: 'Investigating', color: 'bg-yellow-900/60 text-yellow-300', dotColor: 'bg-yellow-400' },
  { value: 'resolved', label: 'Resolved', color: 'bg-green-900/60 text-green-300', dotColor: 'bg-green-400' },
  { value: 'ignored', label: 'Ignored', color: 'bg-gray-700 text-gray-400', dotColor: 'bg-gray-400' },
]

export default function TriagePanel({ errorGroup, onUpdate }: TriagePanelProps) {
  const [status, setStatus] = useState(errorGroup.status)
  const [assignee, setAssignee] = useState(errorGroup.assignee ?? '')
  const [notes, setNotes] = useState(errorGroup.notes ?? '')
  const [saving, setSaving] = useState(false)

  const hasChanges =
    status !== errorGroup.status ||
    assignee !== (errorGroup.assignee ?? '') ||
    notes !== (errorGroup.notes ?? '')

  const handleSave = () => {
    if (!hasChanges) return
    setSaving(true)
    onUpdate({ status, assignee: assignee || undefined, notes: notes || undefined })
    setTimeout(() => setSaving(false), 500)
  }

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider">Triage</h3>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ErrorGroup['status'])}
          className="w-full px-3 py-2 text-sm rounded-lg bg-gray-700/50 border border-gray-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="mt-2 flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              STATUS_OPTIONS.find((o) => o.value === status)?.dotColor ?? 'bg-gray-400'
            }`}
          />
          <span className="text-xs text-gray-500">
            {STATUS_OPTIONS.find((o) => o.value === status)?.label}
          </span>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Assignee</label>
        <input
          type="text"
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assign to..."
          className="w-full px-3 py-2 text-sm rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-400 mb-2">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add investigation notes..."
          rows={4}
          className="w-full px-3 py-2 text-sm rounded-lg bg-gray-700/50 border border-gray-600 text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
        />
      </div>

      <button
        onClick={handleSave}
        disabled={!hasChanges || saving}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <Save className="w-4 h-4" />
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
