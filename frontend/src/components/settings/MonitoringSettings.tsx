import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/stores/auth-store';
import {
  listMonitoringIntegrations,
  MonitoringIntegration,
} from '../../services/monitoring-api';
import MonitoringIntegrationCard from './MonitoringIntegrationCard';
import MonitoringIntegrationForm from './MonitoringIntegrationForm';

type IntegrationType = 'prometheus' | 'grafana' | 'alertmanager';

const INTEGRATION_INFO: Record<IntegrationType, { name: string; color: string; bg: string }> = {
  prometheus: { name: 'Prometheus', color: 'text-orange-600', bg: 'bg-orange-100' },
  grafana: { name: 'Grafana', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  alertmanager: { name: 'AlertManager', color: 'text-red-600', bg: 'bg-red-100' },
};

export default function MonitoringSettings() {
  const { user, currentProject } = useAuthStore();
  const [integrations, setIntegrations] = useState<MonitoringIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<MonitoringIntegration | null>(null);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);

  useEffect(() => {
    loadIntegrations();
  }, [user]);

  const loadIntegrations = async () => {
    if (!user?.current_project_id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await listMonitoringIntegrations(user.current_project_id);
      setIntegrations(data);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = (type?: IntegrationType) => {
    setEditingIntegration(null);
    setSelectedType(type || null);
    setShowForm(true);
  };

  const handleEdit = (integration: MonitoringIntegration) => {
    setEditingIntegration(integration);
    setSelectedType(integration.integration_type);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingIntegration(null);
    setSelectedType(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    loadIntegrations();
  };

  const connectedCount = new Set(integrations.map(i => i.integration_type)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Monitoring Integrations</h3>
          <p className="text-sm text-gray-500 mt-1">
            {connectedCount === 0 ? 'Connect your monitoring tools' : `${connectedCount} of 3 connected`}
          </p>
        </div>
        <button
          onClick={() => handleAdd()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Integration
        </button>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-700 bg-red-50 rounded-lg">{error}</div>
      )}

      {/* Status Cards */}
      <div className="grid grid-cols-3 gap-4">
        {(['prometheus', 'grafana', 'alertmanager'] as IntegrationType[]).map((type) => {
          const info = INTEGRATION_INFO[type];
          const integration = integrations.find((i) => i.integration_type === type);
          const isConnected = !!integration;
          return (
            <div
              key={type}
              onClick={() => !isConnected && handleAdd(type)}
              className={`p-4 rounded-lg border ${
                isConnected
                  ? 'border-green-200 bg-green-50'
                  : 'border-dashed border-gray-300 bg-gray-50 hover:border-gray-400 cursor-pointer'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`text-sm font-medium ${isConnected ? 'text-gray-900' : 'text-gray-600'}`}>
                  {info.name}
                </span>
                {isConnected ? (
                  <span className="w-2 h-2 bg-green-500 rounded-full" />
                ) : (
                  <span className="text-xs text-gray-400">+ Add</span>
                )}
              </div>
              <p className="text-xs text-gray-500 truncate">
                {isConnected ? integration?.url : 'Not connected'}
              </p>
            </div>
          );
        })}
      </div>

      {/* Integrations List */}
      {integrations.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h4 className="text-sm font-medium text-gray-900">Connected Integrations</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {integrations.map((integration) => (
              <MonitoringIntegrationCard
                key={integration.id}
                integration={integration}
                onEdit={handleEdit}
                onDelete={loadIntegrations}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {integrations.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No integrations yet</p>
          <p className="text-xs text-gray-500 mt-1 mb-4">Connect Prometheus, Grafana, or AlertManager</p>
          <button
            onClick={() => handleAdd()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Add Integration
          </button>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <MonitoringIntegrationForm
          integration={editingIntegration}
          defaultType={selectedType}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
