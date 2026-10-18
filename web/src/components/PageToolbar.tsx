import type { ReactElement, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface PageToolbarProps {
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  /**
   * Second lane inside the same strip. Flex-wrap is sequential, so filters placed in
   * `children` would push `trailing` off the first row on narrow screens.
   */
  secondary?: ReactNode
  className?: string
}

/** Single control strip under PageHeader — views, search, filters, counters. */
export function PageToolbar({
  leading,
  trailing,
  children,
  secondary,
  className,
}: PageToolbarProps): ReactElement {
  return (
    <div className={cn('min-w-0 rounded bg-surface px-2.5 py-1.5', className)}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {leading ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{leading}</div>
        ) : null}
        {children ? (
          <div className="flex min-w-0 flex-[1_1_18rem] flex-wrap items-center gap-2">
            {children}
          </div>
        ) : null}
        {trailing ? (
          <div className="ml-auto flex shrink-0 flex-wrap items-center gap-2">{trailing}</div>
        ) : null}
      </div>
      {secondary ? (
        <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-1.5">
          {secondary}
        </div>
      ) : null}
    </div>
  )
}
