import { useState, type ReactElement, type ReactNode } from 'react'
import { ChevronDown } from '../lib/icons'
import { cn } from '../lib/utils'

export interface CollapsibleSectionProps {
  title: string
  children: ReactNode
  count?: number
  defaultOpen?: boolean
  /** When false, content stays hidden and the toggle is not shown. */
  expandable?: boolean
  padding?: 'sm' | 'md'
  titleSize?: 'lg' | 'sm'
  variant?: 'card' | 'nested'
  className?: string
}

export function CollapsibleSection({
  title,
  children,
  count,
  defaultOpen = false,
  expandable = true,
  padding = 'md',
  titleSize = 'lg',
  variant = 'card',
  className,
}: CollapsibleSectionProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  const isOpen = expandable && open

  const countSuffix =
    count !== undefined && count > 0 ? (
      titleSize === 'lg' ? (
        <span className="ml-1.5 text-sm font-normal text-muted-foreground">({count})</span>
      ) : (
        <span className="ml-1.5 font-normal normal-case text-subtle-foreground">({count})</span>
      )
    ) : null

  const titleEl =
    titleSize === 'lg' ? (
      <h2 className="text-lg font-medium text-foreground">
        {title}
        {countSuffix}
      </h2>
    ) : (
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
        {countSuffix}
      </h3>
    )

  const header = (
    <div className="flex items-center justify-between gap-2">
      {titleEl}
      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-inset hover:text-foreground"
          aria-expanded={isOpen}
          aria-label={isOpen ? `Свернуть «${title}»` : `Развернуть «${title}»`}
        >
          <ChevronDown
            size={16}
            className={cn('transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </button>
      ) : null}
    </div>
  )

  const body = isOpen ? (
    <div className={cn(variant === 'card' ? 'space-y-4' : 'mt-2')}>{children}</div>
  ) : null

  if (variant === 'nested') {
    return (
      <div className={cn('border-t border-border pt-3', className)}>
        {header}
        {body}
      </div>
    )
  }

  const paddingClass = padding === 'sm' ? 'p-4' : 'p-6'

  return (
    <section className={cn('rounded bg-surface space-y-3', paddingClass, className)}>
      {header}
      {body}
    </section>
  )
}
