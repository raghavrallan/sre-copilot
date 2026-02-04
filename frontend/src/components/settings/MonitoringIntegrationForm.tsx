import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/stores/auth-store';
import {
  MonitoringIntegration,
  createMonitoringIntegration,
  updateMonitoringIntegration,
  testConnection,
  TestConnectionResponse,
} from '../../services/monitoring-api';

interface Props {
  integration: MonitoringIntegration | null;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthType = 'none' | 'basic' | 'apikey';

export default function MonitoringIntegrationForm({ integration, onClose, onSuccess }: Props) {
  const { user } = useAuthStore();
  const isEdit = !!integration;

  // Form state
  const [integrationType, setIntegrationType] = useState<'prometheus' | 'grafana' | 'alertmanager'>(
    integration?.integration_type || 'prometheus'
  );
  const [name, setName] = useState(integration?.name || '');
  const [description, setDescription] = useState(integration?.description || '');
  const [url, setUrl] = useState(integration?.url || '');
  const [authType, setAuthType] = useState<AuthType>('none');
  const [username, setUsername] = useState(integration?.username || '');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(integration?.webhook_enabled ?? true);
  const [isPrimary, setIsPrimary] = useState(integration?.is_primary ?? true);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set initial auth type based on existing integration
  useEffect(() => {
    if (integration) {
      if (integration.username) {
        setAuthType('basic');
      } else {
        setAuthType('none');
      }
    }
  }, [integration]);

  const handleTest = async () => {
    if (!user?.current_project_id || !url) return;

    try {
      setTesting(true);
      setTestResult(null);
      setError(null);

      const result = await testConnection(user.current_project_id, {
        url,
        username: authType === 'basic' ? username : undefined,
        password: authType === 'basic' ? password : undefined,
        api_key: authType === 'apikey' ? apiKey : undefined,
        integration_type: integrationType,
      });

      setTestResult(result);
    } catch (err: any) {
      console.error('Connection test failed:', err);
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'Connection test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.current_project_id) return;

    try {
      setSubmitting(true);
      setError(null);

      const data = {
        integration_type: integrationType,
        name,
        description: description || undefined,
        url,
        username: authType === 'basic' ? username : undefined,
        password: authType === 'basic' && password ? password : undefined,
        api_key: authType === 'apikey' && apiKey ? apiKey : undefined,
        webhook_enabled: webhookEnabled,
        is_primary: isPrimary,
        config: {},
      };

      if (isEdit && integration) {
        await updateMonitoringIntegration(user.current_project_id, integration.id, data);
      } else {
        await createMonitoringIntegration(user.current_project_id, data);
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to save integration:', err);
      setError(err.response?.data?.detail || 'Failed to save integration');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white bg-white rounded-lg max-w-2xl w-full mx-4 my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 text-gray-900">
            {isEdit ? 'Edit Integration' : 'Add Monitoring Integration'}
          </h2>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
          {error && (
            <div className="p-4 bg-red-50 bg-red-50 border border-red-200 border-red-200 rounded">
              <p className="text-sm text-red-800 text-red-800">{error}</p>
            </div>
          )}

          {/* Integration Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
              Integration Type *
            </label>
            <select
              value={integrationType}
              onChange={(e) =>
                setIntegrationType(e.target.value as 'prometheus' | 'grafana' | 'alertmanager')
              }
              disabled={isEdit}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900 disabled:opacity-50"
              required
            >
              <option value="prometheus">Prometheus</option>
              <option value="grafana">Grafana</option>
              <option value="alertmanager">Alert Manager</option>
            </select>
            {isEdit && (
              <p className="mt-1 text-xs text-gray-500 text-gray-600">
                Cannot change integration type after creation
              </p>
            )}
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Production Prometheus"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
              URL *
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g., http://prometheus:9090"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
              required
            />
          </div>

          {/* Authentication Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-2">
              Authentication
            </label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="none"
                  checked={authType === 'none'}
                  onChange={(e) => setAuthType(e.target.value as AuthType)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 text-gray-700">None</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="basic"
                  checked={authType === 'basic'}
                  onChange={(e) => setAuthType(e.target.value as AuthType)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 text-gray-700">Basic Auth</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="apikey"
                  checked={authType === 'apikey'}
                  onChange={(e) => setAuthType(e.target.value as AuthType)}
                  className="mr-2"
                />
                <span className="text-sm text-gray-700 text-gray-700">API Key</span>
              </label>
            </div>
          </div>

          {/* Basic Auth Fields */}
          {authType === 'basic' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
                  Username *
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
                  Password {isEdit && '(leave blank to keep existing)'}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
                  required={!isEdit}
                />
              </div>
            </>
          )}

          {/* API Key Field */}
          {authType === 'apikey' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 text-gray-700 mb-1">
                API Key {isEdit && '(leave blank to keep existing)'}
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="API Key"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white bg-gray-100 text-gray-900 text-gray-900"
                required={!isEdit}
              />
            </div>
          )}

          {/* Webhook Enabled */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={webhookEnabled}
                onChange={(e) => setWebhookEnabled(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 text-gray-700">
                Enable webhook for receiving alerts
              </span>
            </label>
          </div>

          {/* Is Primary */}
          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 text-gray-700">
                Set as primary integration (for future multi-integration support)
              </span>
            </label>
          </div>

          {/* Test Connection Button */}
          <div className="pt-4 border-t border-gray-200 border-gray-200">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !url}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? 'Testing Connection...' : 'Test Connection'}
            </button>
          </div>

          {/* Test Result */}
          {testResult && (
            <div
              className={`p-4 rounded border ${
                testResult.success
                  ? 'bg-green-50 bg-green-50 border-green-200 border-green-200'
                  : 'bg-red-50 bg-red-50 border-red-200 border-red-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                <div className="flex-1">
                  <p
                    className={`text-sm font-medium ${
                      testResult.success
                        ? 'text-green-800 text-green-800'
                        : 'text-red-800 text-red-800'
                    }`}
                  >
                    {testResult.message}
                  </p>
                  {testResult.details && (
                    <div className="mt-2 text-xs text-gray-600 text-gray-600 space-y-1">
                      {Object.entries(testResult.details).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium">{key}:</span> {String(value)}
                        </div>
                      ))}
                    </div>
                  )}
                  {testResult.response_time_ms && (
                    <p className="mt-1 text-xs text-gray-600 text-gray-600">
                      Response time: {testResult.response_time_ms}ms
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 bg-gray-200 bg-gray-100 text-gray-700 text-gray-700 rounded-lg hover:bg-gray-300 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !name || !url}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
