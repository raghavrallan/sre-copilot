import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Project {
  id: string
  name: string
  slug: string
  role: string
  is_active: boolean
}

export interface User {
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
  token: string | null
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
      token: null,
      isAuthenticated: false,
      projects: [],
      currentProject: null,
      login: (token: string, user: User, projects: Project[]) => {
        const currentProject = projects.find(p => p.id === user.current_project_id) || projects[0] || null
        set({ user, isAuthenticated: true, projects, currentProject })
      },
      logout: () => {
        set({ user: null, token: null, isAuthenticated: false, projects: [], currentProject: null })
        localStorage.removeItem('auth-storage')
        document.cookie.split(';').forEach((c) => {
          document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
        })
      },
      switchProject: (_token: string, project: Project) => {
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
      partialize: (state) => ({
        user: state.user,
        projects: state.projects,
        currentProject: state.currentProject,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
