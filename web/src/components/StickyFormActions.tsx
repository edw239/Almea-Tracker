import type { ReactElement, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface StickyFormActionsProps {
  children: ReactNode
  className?: string
}

export function StickyFormActions({ children, className }: StickyFormActionsProps): ReactElement {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 -mx-6 mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-border/80 bg-surface/95 px-6 py-4 backdrop-blur-md motion-reduce:backdrop-blur-none sm:-mx-7 sm:px-7',
        className,
      )}
    >
      {children}
    </div>
  )
}
