import { useState, useEffect } from 'react';
import { useAuthStore } from '../../lib/stores/auth-store';
import { listProjects, Project } from '../../services/projects-api';
import ProjectCard from './ProjectCard';
import ProjectForm from './ProjectForm';
import ProjectMembersModal from './ProjectMembersModal';

export default function ProjectsSettings() {
  const { user, setProjects } = useAuthStore();
  const [projects, setLocalProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [managingMembersProject, setManagingMembersProject] = useState<Project | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    loadProjects();
  }, [user]);

  const loadProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await listProjects();
      setLocalProjects(data);
      // Update auth store with refreshed projects
      const mappedProjects = data.map(p => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        role: p.current_user_role,
        is_active: p.is_active,
      }));
      setProjects(mappedProjects);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load projects');
      console.error('Failed to load projects:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleManageMembers = (project: Project) => {
    setManagingMembersProject(project);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProject(null);
    loadProjects();
  };

  const handleMembersClose = () => {
    setManagingMembersProject(null);
  };

  const handleProjectUpdated = () => {
    loadProjects();
  };

  // Filter projects
  const filteredProjects = projects.filter((p) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return p.is_active;
    if (filterStatus === 'inactive') return !p.is_active;
    return true;
  });

  // Group by active/inactive
  const activeProjects = filteredProjects.filter((p) => p.is_active);
  const inactiveProjects = filteredProjects.filter((p) => !p.is_active);

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
          <h2 className="text-xl font-semibold text-gray-900">Projects</h2>
          <p className="mt-1 text-sm text-gray-600">
            Manage your projects and team members
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Create Project</span>
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Filter */}
      <div className="mb-6 flex items-center space-x-2">
        <span className="text-sm text-gray-600">Filter:</span>
        {(['all', 'active', 'inactive'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`
              px-3 py-1 rounded-full text-sm font-medium transition-colors
              ${
                filterStatus === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }
            `}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {filteredProjects.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border-2 border-dashed border-gray-300">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mt-4 mb-2">
            {filterStatus === 'all' ? 'No projects yet' : `No ${filterStatus} projects`}
          </h3>
          <p className="text-gray-600 mb-4">
            {filterStatus === 'all'
              ? 'Get started by creating your first project'
              : `You don't have any ${filterStatus} projects`}
          </p>
          {filterStatus === 'all' && (
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Project
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Active Projects */}
          {(filterStatus === 'all' || filterStatus === 'active') && activeProjects.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Active Projects
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                  {activeProjects.length}
                </span>
              </h3>
              <div className="space-y-4">
                {activeProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={handleEdit}
                    onManageMembers={handleManageMembers}
                    onStatusChange={handleProjectUpdated}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Inactive Projects */}
          {(filterStatus === 'all' || filterStatus === 'inactive') && inactiveProjects.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                Inactive Projects
                <span className="ml-2 px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                  {inactiveProjects.length}
                </span>
              </h3>
              <div className="space-y-4">
                {inactiveProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onEdit={handleEdit}
                    onManageMembers={handleManageMembers}
                    onStatusChange={handleProjectUpdated}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Members Modal */}
      {managingMembersProject && (
        <ProjectMembersModal
          project={managingMembersProject}
          onClose={handleMembersClose}
        />
      )}
    </div>
  );
}
