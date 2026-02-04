import { useState } from 'react';
import { useAuthStore } from '../../lib/stores/auth-store';
import {
  MonitoringIntegration,
  deleteMonitoringIntegration,
  testExistingIntegration,
  TestConnectionResponse,
} from '../../services/monitoring-api';

interface Props {
  integration: MonitoringIntegration;
  onEdit: (integration: MonitoringIntegration) => void;
  onDelete: () => void;
}

export default function MonitoringIntegrationCard({ integration, onEdit, onDelete }: Props) {
  const { user } = useAuthStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestConnectionResponse | null>(null);

  const handleDelete = async () => {
    if (!user?.current_project_id) return;

    try {
      setDeleting(true);
      await deleteMonitoringIntegration(user.current_project_id, integration.id);
      onDelete();
      setShowDeleteConfirm(false);
    } catch (err: any) {
      console.error('Failed to delete integration:', err);
      alert(err.response?.data?.detail || 'Failed to delete integration');
    } finally {
      setDeleting(false);
    }
  };

  const handleTest = async () => {
    if (!user?.current_project_id) return;

    try {
      setTesting(true);
      setTestResult(null);
      const result = await testExistingIntegration(user.current_project_id, integration.id);
      setTestResult(result);
    } catch (err: any) {
      console.error('Failed to test integration:', err);
      setTestResult({
        success: false,
        message: err.response?.data?.detail || 'Test failed',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleCopyWebhook = () => {
    if (integration.webhook_url) {
      navigator.clipboard.writeText(integration.webhook_url);
      alert('Webhook URL copied to clipboard!');
    }
  };

  const getStatusColor = () => {
    switch (integration.status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 text-green-800';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 bg-gray-100 text-gray-700';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 text-red-800';
      case 'testing':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = () => {
    switch (integration.status) {
      case 'active':
        return '';
      case 'inactive':
        return '';
      case 'error':
        return '';
      case 'testing':
        return '';
      default:
        return '';
    }
  };

  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  return (
    <div className="bg-white bg-white rounded-lg border border-gray-200 border-gray-200 p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center space-x-3 mb-3">
            <span className="text-2xl">{getStatusIcon()}</span>
            <div>
              <h4 className="text-lg font-semibold text-gray-900 text-gray-900">
                {integration.name}
                {integration.is_primary && (
                  <span className="ml-2 px-2 py-1 bg-blue-100 bg-blue-100 text-blue-800 text-blue-800 text-xs font-medium rounded">
                    PRIMARY
                  </span>
                )}
              </h4>
              {integration.description && (
                <p className="text-sm text-gray-600 text-gray-600 mt-1">
                  {integration.description}
                </p>
              )}
            </div>
          </div>

          {/* URL */}
          <div className="mb-3">
            <div className="text-sm text-gray-600 text-gray-600">
              <span className="font-medium">URL:</span>{' '}
              <code className="px-2 py-1 bg-gray-100 bg-gray-100 rounded text-xs">
                {integration.url}
              </code>
            </div>
          </div>

          {/* Status */}
          <div className="flex items-center space-x-4 mb-3">
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 text-gray-600">Status:</span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor()}`}>
                {integration.status_display}
              </span>
            </div>

            {integration.last_test_at && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 text-gray-600">Last test:</span>
                <span className="text-sm text-gray-900 text-gray-900">
                  {formatTimestamp(integration.last_test_at)}
                </span>
                {integration.last_test_success ? (
                  <span className="text-green-600 text-green-600">Pass</span>
                ) : (
                  <span className="text-red-600 text-red-600">Fail</span>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {integration.last_error_message && (
            <div className="mb-3 p-2 bg-red-50 bg-red-50 border border-red-200 border-red-200 rounded">
              <p className="text-xs text-red-800 text-red-800">
                {integration.last_error_message}
              </p>
            </div>
          )}

          {/* Webhook URL */}
          {integration.webhook_enabled && integration.webhook_url && (
            <div className="mb-3">
              <div className="text-sm text-gray-600 text-gray-600 mb-1">Webhook URL:</div>
              <div className="flex items-center space-x-2">
                <code className="flex-1 px-3 py-2 bg-gray-100 bg-gray-100 rounded text-xs font-mono overflow-x-auto">
                  {integration.webhook_url}
                </code>
                <button
                  onClick={handleCopyWebhook}
                  className="px-3 py-2 bg-gray-200 bg-gray-200 text-gray-700 text-gray-700 rounded hover:bg-gray-300 hover:bg-gray-300 transition-colors text-xs"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div
              className={`mb-3 p-3 rounded border ${
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
                    <div className="mt-1 text-xs text-gray-600 text-gray-600">
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
        </div>

        {/* Actions */}
        <div className="ml-4 flex flex-col space-y-2">
          <button
            onClick={() => onEdit(integration)}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm"
          >
            Edit
          </button>
          <button
            onClick={handleTest}
            disabled={testing}
            className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 text-gray-900 mb-4">
              Delete Integration?
            </h3>
            <p className="text-sm text-gray-600 text-gray-600 mb-6">
              Are you sure you want to delete "{integration.name}"? This will also delete all
              associated alerts. This action cannot be undone.
            </p>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 bg-gray-100 text-gray-700 text-gray-700 rounded hover:bg-gray-300 hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
