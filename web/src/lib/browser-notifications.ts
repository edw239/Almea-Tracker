export async function ensureNotificationPermission(): Promise<boolean> {
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function showBrowserNotification(title: string, body: string, taskId?: string | null) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    const note = new Notification(title, { body, tag: taskId ?? title })
    if (taskId) {
      note.onclick = () => {
        window.focus()
        window.location.assign(`/tasks/${taskId}`)
      }
    }
  } catch {
    /* Safari / restricted contexts */
  }
}
