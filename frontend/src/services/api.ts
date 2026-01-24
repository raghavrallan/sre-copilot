import axios from 'axios'
import { useAuthStore } from '../lib/stores/auth-store'

const API_BASE_URL = import.meta.env.VITE_API_GATEWAY_URL || 'http://localhost:8000'

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
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If 401 and not a retry, try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        // Try to refresh token using httpOnly cookie
        await api.post('/api/v1/auth/refresh')

        // Retry original request
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout()

        // Call logout endpoint to clear cookies
        try {
          await api.post('/api/v1/auth/logout')
        } catch {}

        window.location.href = '/login'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
