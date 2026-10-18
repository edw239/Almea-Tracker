import { useEffect } from 'react'
import { ensureNotificationPermission } from '../lib/browser-notifications'
import { useAuth } from '../auth'
import { useStore } from '../store'

const POLL_MS = 60_000

/** Polls notifications + summary every minute while the user is signed in. */
export function useInboxPolling(): void {
  const auth = useAuth()
  const store = useStore()

  useEffect(() => {
    if (!auth.user || auth.user.mustChangePassword) return
    void ensureNotificationPermission()
    void store.loadNotifications()
    void store.loadSummary()
    const timer = window.setInterval(() => {
      void store.loadNotifications()
      void store.loadSummary()
    }, POLL_MS)
    return () => window.clearInterval(timer)
  }, [auth.user, store.loadNotifications, store.loadSummary])
}
