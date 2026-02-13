import { useState, useRef, useEffect } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/stores/auth-store'
import ProjectSwitcher from './ProjectSwitcher'

interface NavGroup {
  label: string
  items: { to: string; label: string }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'Observe',
    items: [
      { to: '/apm', label: 'APM' },
      { to: '/infrastructure', label: 'Infrastructure' },
      { to: '/logs', label: 'Logs' },
      { to: '/errors', label: 'Errors' },
      { to: '/tracing', label: 'Tracing' },
      { to: '/browser', label: 'Browser' },
      { to: '/service-map', label: 'Service Map' },
    ],
  },
  {
    label: 'Respond',
    items: [
      { to: '/incidents', label: 'Incidents' },
      { to: '/alerts', label: 'Alerts' },
      { to: '/slos', label: 'SLOs' },
    ],
  },
  {
    label: 'Analyze',
    items: [
      { to: '/dashboards', label: 'Dashboards' },
      { to: '/analytics', label: 'AI Analytics' },
      { to: '/synthetics', label: 'Synthetics' },
      { to: '/deployments', label: 'Deployments' },
      { to: '/security', label: 'Security' },
    ],
  },
]

function NavDropdown({ group }: { group: NavGroup }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const isActive = group.items.some((item) => location.pathname.startsWith(item.to))

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
          isActive ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-900'
        }`}
      >
        {group.label}
        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-50 mt-2 w-48 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1">
            {group.items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2 text-sm ${
                  location.pathname.startsWith(item.to)
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center px-2 text-xl font-bold text-blue-600">
                SRE Copilot
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:items-center sm:space-x-6">
                <Link
                  to="/"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-900"
                >
                  Dashboard
                </Link>
                {navGroups.map((group) => (
                  <NavDropdown key={group.label} group={group} />
                ))}
                <Link
                  to="/status"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                >
                  Status
                </Link>
                <Link
                  to="/settings"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-gray-500 hover:text-gray-900"
                >
                  Settings
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ProjectSwitcher />
              <span className="text-sm text-gray-700">
                {user?.full_name} ({user?.tenant_name})
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
