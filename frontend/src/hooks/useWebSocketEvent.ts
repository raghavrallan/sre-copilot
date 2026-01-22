import { useEffect, useRef } from 'react'
import { useWebSocket } from '../contexts/WebSocketContext'

/**
 * Hook to subscribe to specific WebSocket event types
 * @param eventType The event type to listen for (e.g., 'incident.created')
 * @param callback Callback function to handle the event data
 * @param dependencies Optional dependencies array to re-subscribe when changed
 */
export const useWebSocketEvent = <T = any>(
  eventType: string,
  callback: (data: T) => void,
  dependencies: any[] = []
) => {
  const { subscribe } = useWebSocket()
  const callbackRef = useRef(callback)

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback])

  useEffect(() => {
    const unsubscribe = subscribe(eventType, (data: T) => {
      callbackRef.current(data)
    })

    return () => {
      unsubscribe()
    }
  }, [eventType, subscribe, ...dependencies])
}

/**
 * Hook to subscribe to multiple WebSocket event types
 * @param eventHandlers Object mapping event types to their handlers
 */
export const useWebSocketEvents = (eventHandlers: Record<string, (data: any) => void>) => {
  const { subscribe } = useWebSocket()

  useEffect(() => {
    const unsubscribers = Object.entries(eventHandlers).map(([eventType, handler]) => {
      return subscribe(eventType, handler)
    })

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe())
    }
  }, [subscribe, JSON.stringify(Object.keys(eventHandlers))])
}
