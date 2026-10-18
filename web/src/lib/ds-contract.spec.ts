import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = join(import.meta.dirname, '..')

const HEX_IN_TSX = /#[0-9a-fA-F]{3,8}\b/
/** Lemon/accent as text color is forbidden — fill only (Almea rule). */
const TEXT_ACCENT = /\btext-accent\b(?!-foreground)/
const NATIVE_DIALOGS = /\bwindow\.(confirm|prompt|alert)\s*\(/

/** Status column colors are API/domain data, not chrome — exclude from HEX ban. */
const HEX_ALLOWLIST = new Set([
  join('data', 'seed.ts'),
  join('lib', 'status.ts'),
  join('pages', 'ListPage.tsx'),
])

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) return out
  for (const entry of readdirSync(dir)) {
    if (entry === 'legacy-compat.css') continue
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...collectSourceFiles(full))
    } else if (/\.(tsx|ts)$/.test(entry) && !/\.(spec|test)\.(tsx|ts)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

describe('design-system contract (src)', () => {
  const files = collectSourceFiles(SRC_ROOT)

  it('scans source files', () => {
    expect(files.length).toBeGreaterThan(20)
  })

  it('forbids raw HEX colors in chrome (components/hooks/config)', () => {
    const offenders: string[] = []
    for (const file of files) {
      const rel = relative(SRC_ROOT, file)
      if (HEX_ALLOWLIST.has(rel)) continue
      const text = readFileSync(file, 'utf8')
      if (HEX_IN_TSX.test(text)) {
        offenders.push(rel)
      }
    }
    expect(offenders).toEqual([])
  })

  it('forbids text-accent without -foreground (lemon is fill-only)', () => {
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      if (TEXT_ACCENT.test(text)) {
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })

  it('forbids window.confirm / prompt / alert', () => {
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      if (NATIVE_DIALOGS.test(text)) {
        offenders.push(relative(SRC_ROOT, file))
      }
    }
    expect(offenders).toEqual([])
  })
})
