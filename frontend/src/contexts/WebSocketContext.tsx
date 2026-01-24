import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from '../lib/stores/auth-store'
import toast from 'react-hot-toast'

const WEBSOCKET_URL = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8005'
const RECONNECT_INTERVAL = 5000
const MAX_RECONNECT_ATTEMPTS = 10

export interface WebSocketMessage {
  type: string
  data?: any
  clientId?: string
  tenantId?: string
  timestamp?: string
}

interface WebSocketContextType {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  sendMessage: (message: WebSocketMessage) => void
  subscribe: (eventType: string, callback: (data: any) => void) => () => void
  lastMessage: WebSocketMessage | null
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined)

export const useWebSocket = () => {
  const context = useContext(WebSocketContext)
  if (!context) {
    throw new Error('useWebSocket must be used within WebSocketProvider')
  }
  return context
}

interface WebSocketProviderProps {
  children: React.ReactNode
}

export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const subscribersRef = useRef<Map<string, Set<(data: any) => void>>>(new Map())

  const { user, isAuthenticated, currentProject } = useAuthStore()

  const connect = useCallback(async () => {
    if (!isAuthenticated || !user || !currentProject) {
      setConnectionStatus('disconnected')
      return
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    try {
      setConnectionStatus('connecting')

      // Fetch WebSocket token using httpOnly cookie
      const tokenResponse = await fetch('http://localhost:8000/api/v1/auth/ws-token', {
        credentials: 'include'
      })

      if (!tokenResponse.ok) {
        console.error('Failed to get WebSocket token')
        setConnectionStatus('error')
        return
      }

      const { token } = await tokenResponse.json()

      const ws = new WebSocket(`${WEBSOCKET_URL}/ws`)

      ws.onopen = () => {
        console.log('WebSocket connected')

        // Send authentication message with project context
        const authMessage = {
          type: 'connect',
          token: token,
          tenantId: user.tenant_id,
          projectId: currentProject.id
        }
        ws.send(JSON.stringify(authMessage))
      }

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data)
          setLastMessage(message)

          // Handle connection confirmation
          if (message.type === 'connected') {
            setIsConnected(true)
            setConnectionStatus('connected')
            reconnectAttemptsRef.current = 0
            toast.success('Real-time updates connected', { duration: 2000 })
          }

          // Handle pong
          if (message.type === 'pong') {
            return
          }

          // Notify subscribers
          const callbacks = subscribersRef.current.get(message.type)
          if (callbacks) {
            callbacks.forEach(callback => {
              try {
                callback(message.data)
              } catch (error) {
                console.error('Error in WebSocket subscriber callback:', error)
              }
            })
          }

          // Handle specific event types with toast notifications
          switch (message.type) {
            case 'incident.created':
              toast((t) => (
                <div className="flex items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-red-600">New Incident Created</p>
                    <p className="text-sm text-gray-600">{message.data?.title || 'New incident detected'}</p>
                  </div>
                </div>
              ), { duration: 5000 })
              break

            case 'incident.updated':
              toast((t) => (
                <div className="flex items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-blue-600">Incident Updated</p>
                    <p className="text-sm text-gray-600">{message.data?.title || 'Incident status changed'}</p>
                  </div>
                </div>
              ), { duration: 3000 })
              break

            case 'hypothesis.generated':
              toast((t) => (
                <div className="flex items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-purple-600">AI Hypothesis Generated</p>
                    <p className="text-sm text-gray-600">New hypothesis available</p>
                  </div>
                </div>
              ), { duration: 4000 })
              break

            case 'alert.fired':
              toast((t) => (
                <div className="flex items-start">
                  <div className="flex-1">
                    <p className="font-semibold text-orange-600">Alert Fired</p>
                    <p className="text-sm text-gray-600">{message.data?.alertname || 'New alert triggered'}</p>
                  </div>
                </div>
              ), { duration: 4000 })
              break
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setConnectionStatus('error')
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setIsConnected(false)
        setConnectionStatus('disconnected')
        wsRef.current = null

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++
          console.log(`Attempting to reconnect (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})...`)

          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, RECONNECT_INTERVAL)
        } else {
          toast.error('Failed to connect to real-time updates', { duration: 5000 })
        }
      }

      wsRef.current = ws
    } catch (error) {
      console.error('Error creating WebSocket connection:', error)
      setConnectionStatus('error')
    }
  }, [isAuthenticated, user, currentProject])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setIsConnected(false)
    setConnectionStatus('disconnected')
  }, [])

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    } else {
      console.warn('WebSocket is not connected')
    }
  }, [])

  const subscribe = useCallback((eventType: string, callback: (data: any) => void) => {
    if (!subscribersRef.current.has(eventType)) {
      subscribersRef.current.set(eventType, new Set())
    }
    subscribersRef.current.get(eventType)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = subscribersRef.current.get(eventType)
      if (callbacks) {
        callbacks.delete(callback)
        if (callbacks.size === 0) {
          subscribersRef.current.delete(eventType)
        }
      }
    }
  }, [])

  // Connect when authenticated
  useEffect(() => {
    if (isAuthenticated && user && currentProject) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [isAuthenticated, user, currentProject, connect, disconnect])

  // Send ping every 30 seconds to keep connection alive
  useEffect(() => {
    if (!isConnected) return

    const pingInterval = setInterval(() => {
      sendMessage({ type: 'ping' })
    }, 30000)

    return () => {
      clearInterval(pingInterval)
    }
  }, [isConnected, sendMessage])

  const value: WebSocketContextType = {
    isConnected,
    connectionStatus,
    sendMessage,
    subscribe,
    lastMessage,
  }

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  )
}
