import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Project {
  id: string
  name: string
  slug: string
  role: string
  is_active: boolean
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
  tenant_id: string
  tenant_name: string
  current_project_id?: string
  current_project_role?: string
}

interface AuthState {
  user: User | null
  token: string | null  // Deprecated - keeping for backward compatibility
  isAuthenticated: boolean
  projects: Project[]
  currentProject: Project | null
  login: (token: string, user: User, projects: Project[]) => void
  logout: () => void
  switchProject: (token: string, project: Project) => void
  setProjects: (projects: Project[]) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,  // No longer storing token in localStorage (using httpOnly cookies)
      isAuthenticated: false,
      projects: [],
      currentProject: null,
      login: (token: string, user: User, projects: Project[]) => {
        // Find current project from user's current_project_id
        const currentProject = projects.find(p => p.id === user.current_project_id) || projects[0] || null
        // NOTE: token parameter ignored - auth uses httpOnly cookies now
        set({ user, isAuthenticated: true, projects, currentProject })
      },
      logout: () => {
        // Clear state
        set({ user: null, token: null, isAuthenticated: false, projects: [], currentProject: null })
        // Clear localStorage
        localStorage.removeItem('auth-storage')
        // Clear all cookies
        document.cookie.split(';').forEach((c) => {
          document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
        })
      },
      switchProject: (token: string, project: Project) => {
        // Update current project (token is managed by httpOnly cookies)
        set((state) => ({
          currentProject: project,
          user: state.user ? { ...state.user, current_project_id: project.id, current_project_role: project.role } : null
        }))
      },
      setProjects: (projects: Project[]) => {
        set({ projects })
      },
    }),
    {
      name: 'auth-storage',
      // Only persist non-sensitive UI state (user info, projects)
      // Token is now in httpOnly cookies (secure, not accessible by JS)
      // No need to encrypt since no sensitive data stored here
      partialize: (state) => ({
        user: state.user,
        projects: state.projects,
        currentProject: state.currentProject,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
