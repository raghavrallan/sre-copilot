import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/stores/auth-store';
import {
  listMonitoringIntegrations,
  MonitoringIntegration,
} from '../../services/monitoring-api';
import MonitoringIntegrationCard from './MonitoringIntegrationCard';
import MonitoringIntegrationForm from './MonitoringIntegrationForm';

export default function MonitoringSettings() {
  const { user } = useAuthStore();
  const [integrations, setIntegrations] = useState<MonitoringIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingIntegration, setEditingIntegration] = useState<MonitoringIntegration | null>(null);
  const [filterType, setFilterType] = useState<string>('all');

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
      setError(err.response?.data?.detail || 'Failed to load monitoring integrations');
      console.error('Failed to load integrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingIntegration(null);
    setShowForm(true);
  };

  const handleEdit = (integration: MonitoringIntegration) => {
    setEditingIntegration(integration);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingIntegration(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingIntegration(null);
    loadIntegrations();
  };

  const handleDelete = () => {
    loadIntegrations();
  };

  // Group integrations by type
  const groupedIntegrations = {
    prometheus: integrations.filter((i) => i.integration_type === 'prometheus'),
    grafana: integrations.filter((i) => i.integration_type === 'grafana'),
    alertmanager: integrations.filter((i) => i.integration_type === 'alertmanager'),
  };

  // Filter integrations
  const filteredIntegrations =
    filterType === 'all'
      ? integrations
      : integrations.filter((i) => i.integration_type === filterType);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 text-gray-900">
            Monitoring Integrations
          </h2>
          <p className="mt-1 text-sm text-gray-600 text-gray-600">
            Connect Prometheus, Grafana, and AlertManager to receive alerts
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <span>Add Integration</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 bg-red-50 border border-red-200 border-red-200 rounded-lg">
          <p className="text-sm text-red-800 text-red-800">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex items-center space-x-2">
        <span className="text-sm text-gray-600 text-gray-600">Filter:</span>
        {['all', 'prometheus', 'grafana', 'alertmanager'].map((type) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${
                filterType === type
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 bg-gray-200 text-gray-700 text-gray-700 hover:bg-gray-300 hover:bg-gray-300'
              }
            `}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {filteredIntegrations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 bg-white rounded-lg border-2 border-dashed border-gray-300 border-gray-300">
          <h3 className="text-lg font-medium text-gray-900 text-gray-900 mb-2">
            No monitoring integrations yet
          </h3>
          <p className="text-gray-600 text-gray-600 mb-4">
            Get started by adding your first Prometheus, Grafana, or AlertManager integration
          </p>
          <button
            onClick={handleAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Your First Integration
          </button>
        </div>
      ) : (
        <>
          {/* Prometheus Section */}
          {(filterType === 'all' || filterType === 'prometheus') &&
            groupedIntegrations.prometheus.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 text-gray-900 mb-4 flex items-center">
                  Prometheus
                  <span className="ml-2 px-2 py-1 bg-blue-100 bg-blue-100 text-blue-800 text-blue-800 text-xs font-medium rounded-full">
                    {groupedIntegrations.prometheus.length}
                  </span>
                </h3>
                <div className="space-y-4">
                  {groupedIntegrations.prometheus.map((integration) => (
                    <MonitoringIntegrationCard
                      key={integration.id}
                      integration={integration}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Grafana Section */}
          {(filterType === 'all' || filterType === 'grafana') &&
            groupedIntegrations.grafana.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 text-gray-900 mb-4 flex items-center">
                  Grafana
                  <span className="ml-2 px-2 py-1 bg-orange-100 bg-orange-100 text-orange-800 text-orange-800 text-xs font-medium rounded-full">
                    {groupedIntegrations.grafana.length}
                  </span>
                </h3>
                <div className="space-y-4">
                  {groupedIntegrations.grafana.map((integration) => (
                    <MonitoringIntegrationCard
                      key={integration.id}
                      integration={integration}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* AlertManager Section */}
          {(filterType === 'all' || filterType === 'alertmanager') &&
            groupedIntegrations.alertmanager.length > 0 && (
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 text-gray-900 mb-4 flex items-center">
                  Alert Manager
                  <span className="ml-2 px-2 py-1 bg-red-100 bg-red-100 text-red-800 text-red-800 text-xs font-medium rounded-full">
                    {groupedIntegrations.alertmanager.length}
                  </span>
                </h3>
                <div className="space-y-4">
                  {groupedIntegrations.alertmanager.map((integration) => (
                    <MonitoringIntegrationCard
                      key={integration.id}
                      integration={integration}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <MonitoringIntegrationForm
          integration={editingIntegration}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
