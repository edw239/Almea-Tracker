import type { CSSProperties, ReactElement } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Building2, Folder, ListTodo, Search, User } from '../../lib/icons'
import { api } from '../../lib/api'
import { TASK_KEY_PATTERN } from '../../lib/space-key'
import { searchIndex, type SearchHit, type SearchResultKind } from '../../lib/search-index'
import { cn } from '../../lib/utils'
import { useStore } from '../../store'

const KIND_META: Record<SearchResultKind, { label: string; icon: typeof Search }> = {
  task: { label: 'Задача', icon: ListTodo },
  list: { label: 'Список', icon: Folder },
  space: { label: 'Пространство', icon: Folder },
  user: { label: 'Человек', icon: User },
  brand: { label: 'Бренд', icon: Building2 },
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])
  return debounced
}

interface GlobalSearchProps {
  compact?: boolean
  className?: string
}

export function GlobalSearch({ compact = false, className }: GlobalSearchProps): ReactElement {
  const navigate = useNavigate()
  const store = useStore()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(!compact)
  const [activeIndex, setActiveIndex] = useState(0)
  const debouncedQuery = useDebouncedValue(query, 280)
  const anchorRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const docs = useMemo(() => {
    const out = [
      ...store.tasks.map((task) => ({
        id: task.id,
        kind: 'task' as const,
        title: task.title,
        to: `/tasks/${task.id}`,
      })),
      ...store.lists.map((list) => ({
        id: list.id,
        kind: 'list' as const,
        title: list.name,
        to: `/lists/${list.id}`,
      })),
      ...store.spaces.map((space) => ({
        id: space.id,
        kind: 'space' as const,
        title: space.name,
        to: `/spaces/${space.id}`,
      })),
      ...store.users.map((user) => ({
        id: user.id,
        kind: 'user' as const,
        title: user.name,
        subtitle: user.role,
        to: `/users/${user.id}`,
      })),
    ]
    return out
  }, [store.lists, store.spaces, store.tasks, store.users])

  const [keyHit, setKeyHit] = useState<SearchHit | null>(null)
  const indexed = useMemo(
    () => searchIndex(docs, debouncedQuery),
    [docs, debouncedQuery],
  )
  const results = keyHit ? [keyHit, ...indexed.filter((hit) => hit.id !== keyHit.id)] : indexed

  useEffect(() => {
    const query = debouncedQuery.trim().toUpperCase()
    if (!TASK_KEY_PATTERN.test(query)) {
      setKeyHit(null)
      return
    }
    let cancelled = false
    void api.taskByKey(query).then((task) => {
      if (cancelled) return
      setKeyHit({
        id: task.id,
        kind: 'task',
        title: `${task.key ?? query} ${task.title}`,
        to: `/browse/${query}`,
        score: 1000,
      })
    }).catch(() => {
      if (!cancelled) setKeyHit(null)
    })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery])

  const updatePanelPosition = useCallback((): void => {
    const anchor = anchorRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const width = Math.max(rect.width, compact ? 320 : rect.width)
    const left = Math.min(rect.left, window.innerWidth - width - 16)
    setPanelStyle({
      position: 'fixed',
      top: rect.bottom + 8,
      left: Math.max(16, left),
      width,
      zIndex: 200,
      visibility: 'visible',
    })
  }, [compact])

  const showDropdown = open && debouncedQuery.trim().length >= 2

  useEffect(() => {
    setActiveIndex(0)
  }, [debouncedQuery])

  useEffect(() => {
    if (!showDropdown) return
    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)
    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [showDropdown, updatePanelPosition, results.length])

  useEffect(() => {
    function onPointerDown(event: MouseEvent): void {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
      if (compact && !query.trim()) setExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [compact, query])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      const isModK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k'
      if (isModK) {
        event.preventDefault()
        setExpanded(true)
        setOpen(true)
        window.setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (event.key === 'Escape') {
        setOpen(false)
        if (compact) {
          setExpanded(false)
          setQuery('')
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [compact])

  const go = (hit: SearchHit): void => {
    navigate(hit.to)
    setOpen(false)
    setQuery('')
    if (compact) setExpanded(false)
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!showDropdown || results.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((i) => Math.min(results.length - 1, i + 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((i) => Math.max(0, i - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const hit = results[activeIndex]
      if (hit) go(hit)
    }
  }

  if (compact && !expanded) {
    return (
      <button
        type="button"
        className={cn(
          'inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-inset hover:text-foreground',
          className,
        )}
        aria-label="Поиск (Ctrl+K)"
        onClick={() => {
          setExpanded(true)
          setOpen(true)
          window.setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <Search size={18} strokeWidth={1.5} />
      </button>
    )
  }

  return (
    <div ref={anchorRef} className={cn('relative min-w-0', className)}>
      <div className="flex items-center gap-2 rounded-full bg-inset px-3 py-1.5">
        <Search size={16} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Поиск…"
          className="w-44 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground sm:w-56"
          aria-label="Поиск"
          aria-expanded={showDropdown}
          aria-controls="global-search-listbox"
          role="combobox"
          autoComplete="off"
        />
        <kbd className="hidden rounded bg-elevated px-1.5 py-0.5 text-[10px] text-subtle-foreground sm:inline">
          ⌘K
        </kbd>
      </div>

      {showDropdown && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id="global-search-listbox"
              role="listbox"
              style={panelStyle}
              className="overlay-surface max-h-[min(60vh,24rem)] overflow-y-auto bg-elevated p-1.5 animate-in fade-in-0 zoom-in-95"
            >
              {results.length === 0 ? (
                <p className="px-3 py-4 text-sm text-muted-foreground">Ничего не найдено</p>
              ) : (
                results.map((hit, index) => {
                  const meta = KIND_META[hit.kind]
                  const Icon = meta.icon
                  return (
                    <button
                      key={`${hit.kind}-${hit.id}`}
                      type="button"
                      role="option"
                      aria-selected={index === activeIndex}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                        index === activeIndex ? 'bg-inset' : 'hover:bg-inset/70',
                      )}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => go(hit)}
                    >
                      <Icon size={16} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-foreground">{hit.title}</span>
                        <span className="block truncate text-xs text-subtle-foreground">
                          {meta.label}
                          {hit.subtitle ? ` · ${hit.subtitle}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
