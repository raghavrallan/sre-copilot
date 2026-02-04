/**
 * Projects API Client
 * Handles all API calls for project management and member management
 */

import api from './api';

export type ProjectRole = 'owner' | 'admin' | 'engineer' | 'viewer';

export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string;
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  member_count: number;
  current_user_role: ProjectRole;
}

export interface ProjectMember {
  user_id: string;
  user_email: string;
  user_name: string;
  role: ProjectRole;
  joined_at: string;
}

export interface CreateProjectRequest {
  name: string;
  slug: string;
  description?: string;
  timezone?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  timezone?: string;
  is_active?: boolean;
}

export interface AddMemberRequest {
  user_email: string;
  role?: ProjectRole;
}

export interface UpdateMemberRequest {
  role: ProjectRole;
}

// Common timezone options
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (US)' },
  { value: 'America/Chicago', label: 'Central Time (US)' },
  { value: 'America/Denver', label: 'Mountain Time (US)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (US)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
];

// Role options for member management
export const ROLE_OPTIONS: { value: ProjectRole; label: string; description: string }[] = [
  { value: 'admin', label: 'Admin', description: 'Can manage project settings and members' },
  { value: 'engineer', label: 'Engineer', description: 'Can manage incidents and integrations' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to project data' },
];

/**
 * List all projects for the current user
 */
export async function listProjects(): Promise<Project[]> {
  const response = await api.get('/api/v1/projects');
  return response.data;
}

/**
 * Get a specific project
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await api.get(`/api/v1/projects/${projectId}`);
  return response.data;
}

/**
 * Create a new project
 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await api.post('/api/v1/projects', data);
  return response.data;
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  data: UpdateProjectRequest
): Promise<Project> {
  const response = await api.patch(`/api/v1/projects/${projectId}`, data);
  return response.data;
}

/**
 * Delete (deactivate) a project
 */
export async function deleteProject(
  projectId: string
): Promise<{ status: string; message: string }> {
  const response = await api.delete(`/api/v1/projects/${projectId}`);
  return response.data;
}

/**
 * List all members of a project
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMember[]> {
  const response = await api.get(`/api/v1/projects/${projectId}/members`);
  return response.data;
}

/**
 * Add a member to a project
 */
export async function addProjectMember(
  projectId: string,
  data: AddMemberRequest
): Promise<ProjectMember> {
  const response = await api.post(`/api/v1/projects/${projectId}/members`, data);
  return response.data;
}

/**
 * Update a member's role
 */
export async function updateMemberRole(
  projectId: string,
  userId: string,
  data: UpdateMemberRequest
): Promise<ProjectMember> {
  const response = await api.patch(`/api/v1/projects/${projectId}/members/${userId}`, data);
  return response.data;
}

/**
 * Remove a member from a project
 */
export async function removeProjectMember(
  projectId: string,
  userId: string
): Promise<{ status: string; message: string }> {
  const response = await api.delete(`/api/v1/projects/${projectId}/members/${userId}`);
  return response.data;
}

/**
 * Generate slug from project name
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
