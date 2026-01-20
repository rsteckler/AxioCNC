import { useState, useEffect, useCallback } from 'react'

export interface Notification {
  id: string
  type: 'error' | 'warning' | 'info'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

/**
 * Hook for managing notifications
 * Returns functions to add notifications and the notification state
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)

  const addNotification = useCallback((type: 'error' | 'warning' | 'info', title: string, message: string) => {
    const notification: Notification = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      type,
      title,
      message,
      timestamp: new Date(),
      read: false,
    }
    setNotifications(prev => [notification, ...prev])
    setNotificationsOpen(true)
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
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  }
}
