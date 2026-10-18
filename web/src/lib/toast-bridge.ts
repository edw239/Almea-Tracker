import { toast } from 'sonner'

let lastMessage: string | null = null
let lastAt = 0
const DEDUPE_MS = 2_500

/** Surfaces store/action failures as toasts; identical messages are coalesced briefly. */
export function toastStoreError(message: string): void {
  const now = Date.now()
  if (message === lastMessage && now - lastAt < DEDUPE_MS) return
  lastMessage = message
  lastAt = now
  toast.error(message)
}

/** Test helper — resets dedupe state. */
export function resetToastBridgeForTests(): void {
  lastMessage = null
  lastAt = 0
}
