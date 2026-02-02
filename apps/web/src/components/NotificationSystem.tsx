import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell, AlertCircle, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useNotifications } from '@/hooks/useNotifications'
export type { Notification } from '@/hooks/useNotifications'

/**
 * Notification System Component
 * Includes the bell icon button and the notifications dialog
 */
export function NotificationSystem() {
  const { t } = useTranslation()
  const {
    notifications,
    notificationsOpen,
    setNotificationsOpen,
    showProgressNotification,
    markNotificationRead,
    markAllNotificationsRead,
    clearNotifications,
  } = useNotifications()

  // Listen for progress notifications (e.g. XY probe running -> success) so they appear in the toolbox
  useEffect(() => {
    const handle = (e: Event) => {
      const ev = e as CustomEvent<{ key: string; type: 'progress' | 'success'; title: string; message: string }>
      const d = ev.detail
      if (d?.key && d?.type && d?.title != null && d?.message != null) {
        showProgressNotification(d.key, d.type, d.title, d.message)
      }
    }
    window.addEventListener('axiocnc:progressNotification', handle)
    return () => window.removeEventListener('axiocnc:progressNotification', handle)
  }, [showProgressNotification])

  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <>
      {/* Notifications button */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          onClick={() => setNotificationsOpen(true)}
        >
          <Bell className="w-4 h-4" />
        </Button>
        {unreadCount > 0 && (
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
            <span className="text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </div>
        )}
      </div>

      {/* Notifications Modal */}
      <Dialog open={notificationsOpen} onOpenChange={setNotificationsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{t('Notifications & Errors')}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto min-h-0 space-y-2 mt-4">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('No notifications')}
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${
                    notification.type === 'error'
                      ? 'border-red-500/50 bg-red-500/10'
                      : notification.type === 'warning'
                      ? 'border-yellow-500/50 bg-yellow-500/10'
                      : notification.type === 'progress'
                      ? 'border-blue-500/50 bg-blue-500/10'
                      : notification.type === 'success'
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-border bg-muted/30'
                  } ${!notification.read ? 'opacity-100' : 'opacity-60'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {notification.type === 'error' ? (
                        <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      ) : notification.type === 'success' ? (
                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      ) : notification.type === 'progress' ? (
                        <Bell className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                      ) : (
                        <Bell className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{notification.title}</div>
                        <div className="text-sm text-muted-foreground mt-1">
                          {notification.message}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {notification.timestamp.toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => markNotificationRead(notification.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={clearNotifications}
            >
              {t('Clear All')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={markAllNotificationsRead}
            >
              {t('Mark All Read')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
