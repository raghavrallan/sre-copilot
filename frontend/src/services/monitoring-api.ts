/**
 * Monitoring Integration API Client
 * Handles all API calls for Prometheus, Grafana, and AlertManager integrations
 */

import api from './api';

export interface MonitoringIntegration {
  id: string;
  project_id: string;
  project_name: string;
  integration_type: 'prometheus' | 'grafana' | 'alertmanager';
  integration_type_display: string;
  name: string;
  description?: string;
  url: string;
  username?: string;
  config: Record<string, any>;
  status: 'active' | 'inactive' | 'error' | 'testing';
  status_display: string;
  last_test_at?: string;
  last_test_success: boolean;
  last_error_message?: string;
  webhook_enabled: boolean;
  webhook_url?: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMonitoringIntegrationRequest {
  integration_type: 'prometheus' | 'grafana' | 'alertmanager';
  name: string;
  description?: string;
  url: string;
  username?: string;
  password?: string;
  api_key?: string;
  config?: Record<string, any>;
  webhook_enabled?: boolean;
  is_primary?: boolean;
}

export interface UpdateMonitoringIntegrationRequest {
  name?: string;
  description?: string;
  url?: string;
  username?: string;
  password?: string;
  api_key?: string;
  config?: Record<string, any>;
  webhook_enabled?: boolean;
  status?: string;
  is_primary?: boolean;
}

export interface TestConnectionRequest {
  url: string;
  username?: string;
  password?: string;
  api_key?: string;
  integration_type: 'prometheus' | 'grafana' | 'alertmanager';
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  response_time_ms?: number;
}

export interface MonitoringAlert {
  id: string;
  integration_id: string;
  integration_name: string;
  integration_type: string;
  alert_name: string;
  status: 'firing' | 'resolved' | 'acknowledged';
  status_display: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  severity_display: string;
  summary: string;
  description?: string;
  labels: Record<string, any>;
  annotations: Record<string, any>;
  starts_at: string;
  ends_at?: string;
  external_url?: string;
  fingerprint?: string;
  incident_id?: string;
  received_at: string;
}

/**
 * List all monitoring integrations for a project
 */
export async function listMonitoringIntegrations(
  projectId: string,
  integrationType?: string
): Promise<MonitoringIntegration[]> {
  const params = integrationType ? { integration_type: integrationType } : {};
  const response = await api.get(`/api/v1/projects/${projectId}/monitoring/integrations`, { params });
  return response.data;
}

/**
 * Get a specific monitoring integration
 */
export async function getMonitoringIntegration(
  projectId: string,
  integrationId: string,
  includeSecrets: boolean = false
): Promise<MonitoringIntegration> {
  const params = includeSecrets ? { include_secrets: 'true' } : {};
  const response = await api.get(`/api/v1/projects/${projectId}/monitoring/integrations/${integrationId}`, { params });
  return response.data;
}

/**
 * Create a new monitoring integration
 */
export async function createMonitoringIntegration(
  projectId: string,
  data: CreateMonitoringIntegrationRequest
): Promise<MonitoringIntegration> {
  const response = await api.post(`/api/v1/projects/${projectId}/monitoring/integrations`, data);
  return response.data;
}

/**
 * Update a monitoring integration
 */
export async function updateMonitoringIntegration(
  projectId: string,
  integrationId: string,
  data: UpdateMonitoringIntegrationRequest
): Promise<MonitoringIntegration> {
  const response = await api.patch(`/api/v1/projects/${projectId}/monitoring/integrations/${integrationId}`, data);
  return response.data;
}

/**
 * Delete a monitoring integration
 */
export async function deleteMonitoringIntegration(
  projectId: string,
  integrationId: string
): Promise<{ message: string }> {
  const response = await api.delete(`/api/v1/projects/${projectId}/monitoring/integrations/${integrationId}`);
  return response.data;
}

/**
 * Test connection to a monitoring service (before creating integration)
 */
export async function testConnection(
  projectId: string,
  data: TestConnectionRequest
): Promise<TestConnectionResponse> {
  const response = await api.post(`/api/v1/projects/${projectId}/monitoring/integrations/test-connection`, data);
  return response.data;
}

/**
 * Test an existing monitoring integration
 */
export async function testExistingIntegration(
  projectId: string,
  integrationId: string
): Promise<TestConnectionResponse> {
  const response = await api.post(`/api/v1/projects/${projectId}/monitoring/integrations/${integrationId}/test`);
  return response.data;
}

/**
 * List alerts from monitoring integrations
 */
export async function listMonitoringAlerts(
  projectId: string,
  integrationId?: string,
  status?: string,
  limit: number = 50
): Promise<MonitoringAlert[]> {
  const params: any = { limit };
  if (integrationId) params.integration_id = integrationId;
  if (status) params.status = status;

  const response = await api.get(`/api/v1/projects/${projectId}/monitoring/alerts`, { params });
  return response.data;
}
