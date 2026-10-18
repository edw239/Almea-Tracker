import { cn } from './utils'
import { buttonVariants } from '../components/ui/button'

export const SEGMENT_TRACK = 'inline-flex rounded-full bg-surface overflow-hidden'

export const SEGMENT_ITEM =
  'inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors'

export function segmentItemClass(active: boolean): string {
  return cn(
    SEGMENT_ITEM,
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-inset hover:text-foreground',
  )
}

export const FILTER_BAR =
  'flex min-w-0 flex-wrap items-center gap-2 rounded bg-surface px-3 py-1.5 sm:gap-2.5'

/** Groups related toolbar controls into one quiet, pill-shaped cluster. */
export const TOOLBAR_CONTROL_GROUP =
  'inline-flex shrink-0 items-center gap-0.5 rounded-full bg-inset/60 p-0.5'

/** Applied filter shown in the toolbar. */
export const FILTER_TOKEN =
  'animate-in fade-in-0 zoom-in-95 inline-flex h-8 max-w-full items-center rounded-full bg-accent-soft text-xs text-foreground'

export const FILTER_TOKEN_REMOVE =
  'mr-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-accent/15 focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]'

/** Numeric badge inside a toolbar button, e.g. the active filter count. */
export const TOOLBAR_COUNT_BADGE =
  'inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none tabular-nums text-accent-foreground'

/** @deprecated Prefer Button size="sm" variant="default" */
export const BTN_PRIMARY_COMPACT = buttonVariants({ size: 'sm', variant: 'default' })

/** @deprecated Prefer Button size="sm" variant="outline" */
export const BTN_GHOST_COMPACT = buttonVariants({ size: 'sm', variant: 'outline' })

export function popoverTriggerClass(active: boolean): string {
  return cn(
    'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors sm:h-9 sm:px-3 sm:text-sm',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-surface text-muted-foreground hover:bg-inset hover:text-foreground',
  )
}

export function filterChevronClass(open: boolean): string {
  return cn(
    'h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-200 ease-[var(--ease-out)]',
    open && 'rotate-180',
  )
}

export function chipClass(active: boolean): string {
  return cn(
    'inline-flex h-8 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'bg-surface text-muted-foreground hover:bg-inset hover:text-foreground',
  )
}

export const INPUT_FIELD = 'input-field px-3 py-2.5 text-sm'

export const TABLE_HEADER = 'label-overline'

export const TABLE_ROW =
  'border-b border-border transition-colors hover:bg-surface last:border-b-0'

export const TABLE_CELL = 'px-3.5 py-3 text-sm text-foreground'

export const BADGE_BASE =
  'inline-flex items-center rounded-full bg-inset px-2.5 py-0.5 text-xs font-medium'
