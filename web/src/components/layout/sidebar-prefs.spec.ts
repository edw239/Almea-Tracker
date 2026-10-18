import { describe, expect, it } from 'vitest'
import {
  clampExpandedWidth,
  DEFAULT_SIDEBAR_PREFS,
  LEGACY_SIDEBAR_COLLAPSED_KEY,
  migrateLegacyCollapsedFlag,
  parseSidebarPrefs,
  resolveSidebarDrag,
  SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX,
  SIDEBAR_COLLAPSED_WIDTH_PX,
  SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
  SIDEBAR_MAX_EXPANDED_WIDTH_PX,
  SIDEBAR_MIN_EXPANDED_WIDTH_PX,
  SIDEBAR_PREFS_KEY,
  sidebarDesktopWidthPx,
} from './sidebar-prefs'

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial))
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key)
    },
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
  }
}

describe('parseSidebarPrefs', () => {
  it('returns defaults for null / invalid', () => {
    expect(parseSidebarPrefs(null)).toEqual(DEFAULT_SIDEBAR_PREFS)
    expect(parseSidebarPrefs('{')).toEqual(DEFAULT_SIDEBAR_PREFS)
    expect(parseSidebarPrefs('null')).toEqual(DEFAULT_SIDEBAR_PREFS)
    expect(parseSidebarPrefs('"x"')).toEqual(DEFAULT_SIDEBAR_PREFS)
  })

  it('parses pinned collapsed prefs with width', () => {
    expect(
      parseSidebarPrefs(JSON.stringify({ pinned: true, mode: 'collapsed', expandedWidth: 320 })),
    ).toEqual({
      pinned: true,
      mode: 'collapsed',
      expandedWidth: 320,
    })
  })

  it('coerces unknown mode, non-true pinned, and bad width', () => {
    expect(
      parseSidebarPrefs(JSON.stringify({ pinned: 'yes', mode: 'wide', expandedWidth: 12 })),
    ).toEqual({
      pinned: false,
      mode: 'expanded',
      expandedWidth: SIDEBAR_MIN_EXPANDED_WIDTH_PX,
    })
  })

  it('keeps legacy prefs without expandedWidth', () => {
    expect(parseSidebarPrefs(JSON.stringify({ pinned: true, mode: 'collapsed' }))).toEqual({
      pinned: true,
      mode: 'collapsed',
      expandedWidth: SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
    })
  })
})

describe('clampExpandedWidth / resolveSidebarDrag', () => {
  it('clamps to min/max', () => {
    expect(clampExpandedWidth(10)).toBe(SIDEBAR_MIN_EXPANDED_WIDTH_PX)
    expect(clampExpandedWidth(9999)).toBe(SIDEBAR_MAX_EXPANDED_WIDTH_PX)
    expect(clampExpandedWidth(268.4)).toBe(268)
  })

  it('snaps drag below threshold to collapsed', () => {
    expect(resolveSidebarDrag(SIDEBAR_COLLAPSE_DRAG_THRESHOLD_PX - 1)).toEqual({
      mode: 'collapsed',
    })
  })

  it('keeps expanded width when drag is above threshold', () => {
    expect(resolveSidebarDrag(300)).toEqual({ mode: 'expanded', expandedWidth: 300 })
  })
})

describe('sidebarDesktopWidthPx', () => {
  it('uses collapsed rail or expanded width', () => {
    expect(sidebarDesktopWidthPx({ pinned: false, mode: 'collapsed', expandedWidth: 300 })).toBe(
      SIDEBAR_COLLAPSED_WIDTH_PX,
    )
    expect(sidebarDesktopWidthPx({ pinned: false, mode: 'expanded', expandedWidth: 300 })).toBe(300)
  })
})

describe('migrateLegacyCollapsedFlag', () => {
  it('migrates collapsed=1 into JSON prefs once', () => {
    const storage = memoryStorage({ [LEGACY_SIDEBAR_COLLAPSED_KEY]: '1' })
    migrateLegacyCollapsedFlag(storage)
    expect(JSON.parse(storage.getItem(SIDEBAR_PREFS_KEY)!)).toEqual({
      pinned: false,
      mode: 'collapsed',
      expandedWidth: SIDEBAR_DEFAULT_EXPANDED_WIDTH_PX,
    })
    expect(storage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY)).toBeNull()
  })

  it('does not overwrite existing JSON prefs', () => {
    const existing = JSON.stringify({
      pinned: true,
      mode: 'expanded',
      expandedWidth: 300,
    })
    const storage = memoryStorage({
      [SIDEBAR_PREFS_KEY]: existing,
      [LEGACY_SIDEBAR_COLLAPSED_KEY]: '1',
    })
    migrateLegacyCollapsedFlag(storage)
    expect(storage.getItem(SIDEBAR_PREFS_KEY)).toBe(existing)
    expect(storage.getItem(LEGACY_SIDEBAR_COLLAPSED_KEY)).toBe('1')
  })
})
