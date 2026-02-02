import { useState, useEffect, useCallback } from 'react'

export interface Notification {
  id: string
  type: 'error' | 'warning' | 'info' | 'progress' | 'success'
  title: string
  message: string
  timestamp: Date
  read: boolean
  /** Optional key for progress notifications that can be updated (e.g. bitzero-xy-probe). */
  key?: string
}

/**
 * Hook for managing notifications
 * Returns functions to add notifications and the notification state
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const addNotification = useCallback((
    type: 'error' | 'warning' | 'info' | 'progress' | 'success',
    title: string,
    message: string,
    key?: string
  ): string => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
    const notification: Notification = {
      id,
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
      key,
    }
    setNotifications(prev => [notification, ...prev])
    setNotificationsOpen(true)
    return id
  }, [])

  const updateNotification = useCallback((
    idOrKey: string,
    updates: Partial<Pick<Notification, 'type' | 'title' | 'message'>>
  ) => {
    setNotifications(prev =>
      prev.map(n => {
        const match = n.id === idOrKey || n.key === idOrKey
        if (!match) return n
        return { ...n, ...updates }
      })
    )
  }, [])

  const showErrorNotification = useCallback((title: string, message: string) => {
    addNotification('error', title, message)
  }, [addNotification])

  const showWarningNotification = useCallback((title: string, message: string) => {
    addNotification('warning', title, message)
  }, [addNotification])

  const showInfoNotification = useCallback((title: string, message: string) => {
    addNotification('info', title, message)
  }, [addNotification])

  const showProgressNotification = useCallback((key: string, type: 'progress' | 'success', title: string, message: string) => {
    setNotifications(prev => {
      const existing = prev.find(n => n.key === key)
      if (existing) {
        return prev.map(n => n.key === key ? { ...n, type, title, message } : n)
      }
      const id = Date.now().toString() + Math.random().toString(36).substr(2, 9)
      return [{ id, type, title, message, timestamp: new Date(), read: false, key }, ...prev]
    })
    setNotificationsOpen(true)
  }, [])

  const markNotificationRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    )
  }, [])

  const markAllNotificationsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }, [])

  const clearNotifications = useCallback(() => {
    setNotifications([])
  }, [])

  // Listen for notifications from machineStateSync
  useEffect(() => {
    const handleMachineStateSyncNotification = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type: 'error' | 'warning' | 'info'
        title: string
        message: string
      }>
      if (customEvent.detail) {
        addNotification(customEvent.detail.type, customEvent.detail.title, customEvent.detail.message)
      }
    }

    window.addEventListener('machineStateSync:notification', handleMachineStateSyncNotification)

    return () => {
      window.removeEventListener('machineStateSync:notification', handleMachineStateSyncNotification)
    }
  }, [addNotification])

  return {
    notifications,
    notificationsOpen,
    setNotificationsOpen,
    showErrorNotification,
    showWarningNotification,
    showInfoNotification,
    showProgressNotification,
    addNotification,
    updateNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  }
}
