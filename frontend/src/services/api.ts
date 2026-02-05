import axios from 'axios'
import { useAuthStore } from '../lib/stores/auth-store'

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8580'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,  // Enable sending cookies with requests
})

// Add auth token to requests (for backward compatibility)
// New auth flow uses httpOnly cookies automatically
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle auth errors and automatic token refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: unknown) => void }> = []

const processQueue = (error: unknown = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve()
    }
  })
  failedQueue = []
}

const clearAuthAndRedirect = () => {
  // Clear auth state
  useAuthStore.getState().logout()

  // Clear localStorage
  localStorage.clear()

  // Clear all cookies
  document.cookie.split(';').forEach((c) => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date().toUTCString() + ';path=/')
  })

  // Redirect to login
  if (window.location.pathname !== '/login') {
    window.location.href = '/login'
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not a retry, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Skip refresh for auth endpoints
      if (originalRequest.url?.includes('/auth/login') ||
          originalRequest.url?.includes('/auth/register') ||
          originalRequest.url?.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then(() => api(originalRequest)).catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Try to refresh token using httpOnly cookie
        await api.post('/api/v1/auth/refresh')
        processQueue()
        isRefreshing = false

        // Retry original request
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        isRefreshing = false

        // Refresh failed, clear everything and redirect
        clearAuthAndRedirect()
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
