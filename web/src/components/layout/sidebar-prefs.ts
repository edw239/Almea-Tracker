/** Idle without pointer on the sidebar before auto-collapse (unpinned only). */
export const SIDEBAR_IDLE_COLLAPSE_MS = 30_000

export const SIDEBAR_PREFS_KEY = 'almea.sidebar.prefs'
/** Legacy boolean flag: '1' | '0' — not JSON. */
export const LEGACY_SIDEBAR_COLLAPSED_KEY = 'almea.sidebar.collapsed'

export const SIDEBAR_COLLAPSED_WIDTH_PX = 72
export const SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX = 268
export const SIDEBAR_MIN_EXPANDED_WIDTH_PX = 200
export const SIDEBAR_MAX_EXPANDED_WIDTH_PX = 440
/** Dragging left of this snaps to the short rail. */
export const SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX = 140

export type SidebarMode = 'expanded' | 'collapsed'

export interface SidebarPrefs {
  pinned: boolean
  mode: SidebarMode
  /** Remembered width for the long (expanded) mode, in px. */
  expandedWidth: number
}

export const DEFAULT_SIDEBAR_PREFS: SidebarPrefs = {
  pinned: false,
  mode: 'expanded',
  expandedWidth: SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
}

function isSidebarMode(value: unknown): value is SidebarMode {
  return value === 'expanded' || value === 'collapsed'
}

export function clampExpandedWidth(px: number): number {
  if (!Number.isFinite(px)) return SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX
  return Math.min(
    SIDEBAR_MAX_EXPANDED_WIDTH_PX,
    Math.max(SIDEBAR_MIN_EXPANDED_WIDTH_PX, Math.round(px)),
  )
}

/**
 * Map a live drag width to mode + clamped expanded width.
 * When snapping to collapsed, `expandedWidth` is omitted — caller keeps the previous long width.
 */
export function resolveSidebarDrag(
  px: number,
): { mode: 'collapsed' } | { mode: 'expanded'; expandedWidth: number } {
  if (!Number.isFinite(px) || px < SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX) {
    return { mode: 'collapsed' }
  }
  return {
    mode: 'expanded',
    expandedWidth: clampExpandedWidth(px),
  }
}

export function parseSidebarPrefs(raw: string | null): SidebarPrefs {
  if (raw == null) return { ...DEFAULT_SIDEBAR_PREFS }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed == null || typeof parsed !== 'object') return { ...DEFAULT_SIDEBAR_PREFS }
    const record = parsed as Record<string, unknown>
    const widthRaw = record.expandedWidth
    return {
      pinned: record.pinned === true,
      mode: isSidebarMode(record.mode) ? record.mode : DEFAULT_SIDEBAR_PREFS.mode,
      expandedWidth:
        typeof widthRaw === 'number'
          ? clampExpandedWidth(widthRaw)
          : DEFAULT_SIDEBAR_PREFS.expandedWidth,
    }
  } catch {
    return { ...DEFAULT_SIDEBAR_PREFS }
  }
}

/**
 * One-shot migration from the old boolean key (`'1'|'0'`) into JSON prefs.
 * `readMigratedStorageItem` cannot be used — the legacy value is not JSON.
 */
export function migrateLegacyCollapsedFlag(storage: Storage): void {
  try {
    if (storage.getItem(SIDEBAR_PREFS_KEY) != null) return
    const legacy = storage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY)
    if (legacy == null) return
    const next: SidebarPrefs = {
      ...DEFAULT_SIDEBAR_PREFS,
      mode: legacy === '1' ? 'collapsed' : 'expanded',
    }
    storage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(next))
    storage.removeItem(LEGACY_SIDEBAR_COLLAPSED_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadSidebarPrefs(): SidebarPrefs {
  try {
    migrateLegacyCollapsedFlag(localStorage)
    return parseSidebarPrefs(localStorage.getItem(SIDEBAR_PREFS_KEY))
  } catch {
    return { ...DEFAULT_SIDEBAR_PREFS }
  }
}

export function saveSidebarPrefs(prefs: SidebarPrefs): void {
  try {
    localStorage.setItem(SIDEBAR_PREFS_KEY, JSON.stringify(prefs))
  } catch {
    /* ignore quota / private mode */
  }
}

export function sidebarDesktopWidthPx(prefs: SidebarPrefs): number {
  return prefs.mode === 'collapsed' ? SIDEBAR_COLLAPSED_WIDTH_PX : prefs.expandedWidth
}
