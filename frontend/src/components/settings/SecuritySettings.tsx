import { useAuthStore } from '../../lib/stores/auth-store';

export default function SecuritySettings() {
  const { user } = useAuthStore();

  return (
    <div className="space-y-6">
      {/* Password */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Password</h3>
            <p className="text-sm text-gray-500 mt-1">Update your password to keep your account secure</p>
          </div>
          <button disabled className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-100 rounded-lg cursor-not-allowed">
            Change Password
          </button>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Active Sessions</h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Current Session</p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
          </div>
          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Active</span>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500 mt-1">Add an extra layer of security to your account</p>
          </div>
          <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">Not Enabled</span>
        </div>
      </div>

      {/* API Tokens */}
      <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
        <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <p className="text-sm font-medium text-gray-900">API Tokens</p>
        <p className="text-xs text-gray-500 mt-1">Create and manage API tokens for integrations</p>
        <button disabled className="mt-3 px-4 py-2 text-sm font-medium text-gray-400 bg-gray-200 rounded-lg cursor-not-allowed">
          Coming Soon
        </button>
      </div>
    </div>
  );
}
