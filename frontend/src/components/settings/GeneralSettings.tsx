import { useState } from 'react'
import { Pencil, Check, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../lib/stores/auth-store'
import api from '../../services/api'
import toast from 'react-hot-toast'

export default function GeneralSettings() {
  const { user, currentProject } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [fullName, setFullName] = useState(user?.full_name ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!fullName.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    setSaving(true)
    try {
      const { data } = await api.patch('/api/v1/auth/profile', {
        full_name: fullName.trim(),
      })
      const authStore = useAuthStore.getState()
      if (authStore.user) {
        useAuthStore.setState({
          user: { ...authStore.user, full_name: data.full_name },
        })
      }
      toast.success('Profile updated')
      setEditing(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFullName(user?.full_name ?? '')
    setEditing(false)
  }

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-gray-900">Profile</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              Edit
            </button>
          )}
        </div>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
            {(editing ? fullName : user?.full_name)?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              {editing ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    autoFocus
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p className="text-sm text-gray-900">{user?.full_name || '-'}</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
              <p className="text-sm text-gray-900">{user?.email || '-'}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Role</label>
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-blue-100 text-blue-700 capitalize">
                {user?.role || '-'}
              </span>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">User ID</label>
              <p className="text-xs text-gray-500 font-mono">{user?.id || '-'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Organization Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Organization</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Organization Name</label>
            <p className="text-sm text-gray-900">{user?.tenant_name || '-'}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Tenant ID</label>
            <p className="text-xs text-gray-500 font-mono">{user?.tenant_id || '-'}</p>
          </div>
        </div>
      </div>

      {/* Current Project Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Current Project</h3>
        {currentProject ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center text-white font-semibold">
                {currentProject.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{currentProject.name}</p>
                <p className="text-xs text-gray-500">/{currentProject.slug}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded bg-green-100 text-green-700 capitalize">
                {currentProject.role}
              </span>
              <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                currentProject.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {currentProject.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No project selected</p>
        )}
      </div>
    </div>
  )
}
