import { useState } from 'react';

export default function NotificationSettings() {
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [desktopEnabled, setDesktopEnabled] = useState(false);

  const handleDesktopToggle = async () => {
    if (!desktopEnabled && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDesktopEnabled(true);
      }
    } else {
      setDesktopEnabled(!desktopEnabled);
    }
  };

  const Toggle = ({ enabled, onToggle, disabled = false }: { enabled: boolean; onToggle: () => void; disabled?: boolean }) => (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-10 h-6 rounded-full transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${enabled ? 'bg-blue-600' : 'bg-gray-300'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${enabled ? 'translate-x-4' : ''}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      {/* In-App Notifications */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">In-App Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Push Notifications</p>
              <p className="text-xs text-gray-500">Show notifications within the app</p>
            </div>
            <Toggle enabled={inAppEnabled} onToggle={() => setInAppEnabled(!inAppEnabled)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Sound</p>
              <p className="text-xs text-gray-500">Play sound for new alerts</p>
            </div>
            <Toggle enabled={soundEnabled} onToggle={() => setSoundEnabled(!soundEnabled)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Desktop Notifications</p>
              <p className="text-xs text-gray-500">Browser notifications when tab is not focused</p>
            </div>
            <Toggle enabled={desktopEnabled} onToggle={handleDesktopToggle} />
          </div>
        </div>
      </div>

      {/* Alert Preferences */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Alert Preferences</h3>
        <div className="space-y-3">
          {['Critical', 'High', 'Medium', 'Low', 'Info'].map((severity, i) => (
            <div key={severity} className="flex items-center justify-between py-2 opacity-50">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  i === 0 ? 'bg-red-500' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-yellow-500' : i === 3 ? 'bg-blue-500' : 'bg-gray-400'
                }`} />
                <span className="text-sm text-gray-700">{severity} Alerts</span>
              </div>
              <Toggle enabled={i < 2} onToggle={() => {}} disabled />
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">Alert preferences coming soon</p>
      </div>

      {/* Email & Slack */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">Email</p>
          <p className="text-xs text-gray-500 mt-1">Coming soon</p>
        </div>
        <div className="bg-gray-50 rounded-lg border border-dashed border-gray-300 p-6 text-center">
          <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z"/>
          </svg>
          <p className="text-sm font-medium text-gray-900">Slack</p>
          <p className="text-xs text-gray-500 mt-1">Coming soon</p>
        </div>
      </div>
    </div>
  );
}
