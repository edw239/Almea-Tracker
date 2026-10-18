import type { ReactElement } from 'react'
import { cn } from '../lib/utils'

interface BrandMarkProps {
  collapsed?: boolean
  className?: string
}

/**
 * Wordmark morphs by opacity/width — no PNG swap.
 */
export function BrandMark({ collapsed = false, className }: BrandMarkProps): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 overflow-hidden whitespace-nowrap',
        className,
      )}
    >
      <span
        className={cn(
          'font-sans text-[22px] font-extrabold lowercase tracking-[-0.02em] text-foreground transition-[font-size,letter-spacing] duration-300 ease-[var(--ease-out)]',
          collapsed && 'text-lg',
        )}
      >
        {collapsed ? 'a' : 'almea'}
      </span>
      <span
        className={cn(
          'text-[0.7rem] font-medium uppercase tracking-[0.16em] text-subtle-foreground transition-[opacity,max-width] duration-300 ease-[var(--ease-out)]',
          collapsed ? 'max-w-0 opacity-0' : 'max-w-[6rem] opacity-100',
        )}
        aria-hidden={collapsed}
      >
        tracker
      </span>
    </span>
  )
}
