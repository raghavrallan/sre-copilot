import { useAuthStore } from '../../lib/stores/auth-store';

export default function GeneralSettings() {
  const { user, currentProject } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Profile Section */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Profile</h3>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold flex-shrink-0">
            {user?.full_name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="flex-1 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Full Name</label>
              <p className="text-sm text-gray-900">{user?.full_name || '-'}</p>
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

      {/* Preferences Coming Soon */}
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <p className="text-sm font-medium text-gray-900">Preferences</p>
        <p className="text-xs text-gray-500 mt-1">Theme, timezone, and other settings coming soon</p>
      </div>
    </div>
  );
}
