import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

export type SelectOption<T extends string = string> = {
  value: T
  label: string
  disabled?: boolean
}

type SelectVariant = 'field' | 'toolbar' | 'inline'

type SelectProps<T extends string = string> = {
  value: T
  options: ReadonlyArray<SelectOption<T>>
  onChange: (value: T) => void
  id?: string
  disabled?: boolean
  /** Shown when value is empty or not in options. */
  placeholder?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
  /** `field` — form control; `toolbar` — topbar/filter; `inline` — compact dash row. */
  variant?: SelectVariant
  /** Keep menu width at least trigger width (default true). */
  matchTriggerWidth?: boolean
}

type MenuPos = {
  top: number
  left: number
  width: number
  maxHeight: number
}

const MENU_GAP_PX = 4
const MENU_MIN_WIDTH_PX = 140
const MENU_VIEWPORT_PAD_PX = 8
const MENU_MAX_HEIGHT_PX = 280

function findOptionLabel<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
  value: T,
  placeholder?: string,
): string {
  const match = options.find((item) => item.value === value)
  if (match) return match.label
  return placeholder ?? (value || '—')
}

function firstEnabledIndex<T extends string>(options: ReadonlyArray<SelectOption<T>>): number {
  return options.findIndex((item) => !item.disabled)
}

function nextEnabledIndex<T extends string>(
  options: ReadonlyArray<SelectOption<T>>,
  from: number,
  direction: 1 | -1,
): number {
  if (options.length === 0) return -1
  let index = from
  for (let step = 0; step < options.length; step += 1) {
    index = (index + direction + options.length) % options.length
    if (!options[index]?.disabled) return index
  }
  return from
}

function computeMenuPos(trigger: HTMLElement, menuHeight: number): MenuPos {
  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, MENU_MIN_WIDTH_PX)
  const spaceBelow = window.innerHeight - rect.bottom - MENU_VIEWPORT_PAD_PX
  const spaceAbove = rect.top - MENU_VIEWPORT_PAD_PX
  const openUp = spaceBelow < Math.min(menuHeight, MENU_MAX_HEIGHT_PX) && spaceAbove > spaceBelow
  const maxHeight = Math.min(MENU_MAX_HEIGHT_PX, openUp ? spaceAbove - MENU_GAP_PX : spaceBelow - MENU_GAP_PX)
  const top = openUp ? Math.max(MENU_VIEWPORT_PAD_PX, rect.top - maxHeight - MENU_GAP_PX) : rect.bottom + MENU_GAP_PX
  let left = rect.left
  if (left + width > window.innerWidth - MENU_VIEWPORT_PAD_PX) {
    left = Math.max(MENU_VIEWPORT_PAD_PX, window.innerWidth - width - MENU_VIEWPORT_PAD_PX)
  }
  return { top, left, width, maxHeight: Math.max(120, maxHeight) }
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`ui-select-chevron${open ? ' open' : ''}`}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6.2 8 10l4-3.8" />
    </svg>
  )
}

export function Select<T extends string = string>({
  value,
  options,
  onChange,
  id,
  disabled = false,
  placeholder,
  className,
  variant = 'field',
  matchTriggerWidth = true,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: SelectProps<T>) {
  const listboxId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pos, setPos] = useState<MenuPos | null>(null)

  const selectedIndex = options.findIndex((item) => item.value === value)
  const displayLabel = findOptionLabel(options, value, placeholder)
  const showPlaceholder = Boolean(placeholder) && (value === '' || selectedIndex < 0)

  const close = useCallback((focusTrigger = true) => {
    setOpen(false)
    setPos(null)
    if (focusTrigger) triggerRef.current?.focus()
  }, [])

  const openMenu = useCallback(() => {
    if (disabled) return
    const start = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex(options)
    setActiveIndex(start)
    const trigger = triggerRef.current
    if (trigger) setPos(computeMenuPos(trigger, MENU_MAX_HEIGHT_PX))
    setOpen(true)
  }, [disabled, options, selectedIndex])

  const selectIndex = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option || option.disabled) return
      onChange(option.value)
      close(true)
    },
    [close, onChange, options],
  )

  const updatePos = useCallback(() => {
    const trigger = triggerRef.current
    const menu = menuRef.current
    if (!trigger || !menu) return
    setPos(computeMenuPos(trigger, menu.offsetHeight || MENU_MAX_HEIGHT_PX))
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    updatePos()
    menuRef.current?.focus()
  }, [open, options, updatePos])

  useEffect(() => {
    if (!open) return
    const onReposition = () => updatePos()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePos])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [close, open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const option = menuRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open])

  function onTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) openMenu()
    }
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((prev) => nextEnabledIndex(options, prev < 0 ? -1 : prev, 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((prev) => nextEnabledIndex(options, prev < 0 ? options.length : prev, -1))
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(firstEnabledIndex(options))
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(nextEnabledIndex(options, options.length, -1))
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (activeIndex >= 0) selectIndex(activeIndex)
      return
    }
    if (event.key === 'Tab') {
      close(false)
    }
  }

  const rootClass = ['ui-select', `ui-select--${variant}`, className].filter(Boolean).join(' ')
  const triggerClass = [
    'ui-select-trigger',
    showPlaceholder ? 'is-placeholder' : '',
    open ? 'is-open' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const menuStyle: CSSProperties | undefined = pos
    ? {
        top: pos.top,
        left: pos.left,
        width: matchTriggerWidth ? pos.width : Math.max(pos.width, MENU_MIN_WIDTH_PX),
        maxHeight: pos.maxHeight,
      }
    : { visibility: 'hidden' as const, top: 0, left: 0 }

  let menu: ReactNode = null
  if (open) {
    menu = createPortal(
      <ul
        ref={menuRef}
        id={listboxId}
        className="ui-select-menu"
        role="listbox"
        tabIndex={-1}
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined}
        style={menuStyle}
        onKeyDown={onMenuKeyDown}
      >
        {options.length === 0 ? (
          <li className="ui-select-empty" role="presentation">
            Нет вариантов
          </li>
        ) : (
          options.map((option, index) => {
            const selected = option.value === value
            const active = index === activeIndex
            return (
              <li
                key={option.value === '' ? `__empty-${index}` : option.value}
                id={`${listboxId}-opt-${index}`}
                data-index={index}
                role="option"
                aria-selected={selected}
                aria-disabled={option.disabled || undefined}
                className={[
                  'ui-select-option',
                  selected ? 'is-selected' : '',
                  active ? 'is-active' : '',
                  option.disabled ? 'is-disabled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onMouseEnter={() => {
                  if (!option.disabled) setActiveIndex(index)
                }}
                onMouseDown={(event) => {
                  // Prevent trigger blur before click handler runs.
                  event.preventDefault()
                }}
                onClick={() => selectIndex(index)}
              >
                <span className="ui-select-option-label">{option.label}</span>
                {selected ? <span className="ui-select-check" aria-hidden="true" /> : null}
              </li>
            )
          })
        )}
      </ul>,
      document.body,
    )
  }

  return (
    <div ref={rootRef} className={rootClass}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={triggerClass}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        onClick={() => {
          if (open) close(false)
          else openMenu()
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="ui-select-value">{displayLabel}</span>
        <Chevron open={open} />
      </button>
      {menu}
    </div>
  )
}
