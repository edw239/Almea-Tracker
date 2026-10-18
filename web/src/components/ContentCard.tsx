import type { ReactElement, ReactNode } from 'react'
import { cn } from '../lib/utils'

interface ContentCardProps {
  children: ReactNode
  className?: string
  flush?: boolean
}

export function ContentCard({ children, className, flush }: ContentCardProps): ReactElement {
  return <div className={cn('surface-card', !flush && 'p-6 sm:p-8', className)}>{children}</div>
}

interface CardSectionTitleProps {
  title: string
  description?: string
  action?: ReactNode
}

export function CardSectionTitle({
  title,
  description,
  action,
}: CardSectionTitleProps): ReactElement {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-[1.25rem] font-medium leading-tight tracking-[-0.03em] text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}
