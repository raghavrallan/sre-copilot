import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../lib/stores/auth-store'
import api from '../services/api'
import { ChevronDown, Check } from 'lucide-react'

export default function ProjectSwitcher() {
  const { currentProject, projects, switchProject } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleProjectSwitch = async (projectId: string) => {
    if (projectId === currentProject?.id) {
      setIsOpen(false)
      return
    }

    setLoading(true)
    try {
      // Use cookies for authentication (withCredentials is set in api.ts)
      const response = await api.post(
        '/api/v1/auth/switch-project',
        { project_id: projectId }
      )

      const { access_token, project } = response.data
      switchProject(access_token, project)
      setIsOpen(false)

      // Reload the page to refresh data with new project context
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch project:', error)
    } finally {
      setLoading(false)
    }
  }

  // Show message if no projects available
  if (!currentProject || !projects || projects.length === 0) {
    return (
      <div className="text-sm text-red-600 px-3 py-2 border border-red-300 rounded-md bg-red-50">
        ⚠️ No projects - Please re-login
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        disabled={loading}
      >
        <span className="mr-2">{currentProject.name}</span>
        <ChevronDown className="h-4 w-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b">
              Switch Project
            </div>
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => handleProjectSwitch(project.id)}
                disabled={loading || !project.is_active}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center justify-between ${
                  !project.is_active ? 'opacity-50 cursor-not-allowed' : ''
                } ${currentProject.id === project.id ? 'bg-blue-50' : ''}`}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">{project.name}</div>
                  <div className="text-xs text-gray-500 capitalize">{project.role}</div>
                  {!project.is_active && (
                    <div className="text-xs text-red-500">Inactive</div>
                  )}
                </div>
                {currentProject.id === project.id && (
                  <Check className="h-4 w-4 text-blue-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
