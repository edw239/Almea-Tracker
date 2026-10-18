import type { LucideIcon } from '../lib/icons'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): ReactElement {
  return (
    <div
      className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}
    >
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-inset text-muted-foreground">
        <Icon size={24} strokeWidth={1.5} aria-hidden />
      </div>
      <h3 className="font-display text-2xl tracking-[-0.02em] text-foreground">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
