import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from '../lib/icons'
import { cn } from '../lib/utils'

export interface BreadcrumbItem {
  label: string
  to?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className }: BreadcrumbsProps): ReactElement {
  return (
    <nav
      aria-label="Навигация"
      className={cn('flex flex-wrap items-center gap-1.5 text-sm', className)}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <ChevronRight size={14} className="shrink-0 text-subtle-foreground" aria-hidden />
            ) : null}
            {item.to && !isLast ? (
              <Link
                to={item.to}
                className="text-muted-foreground transition-colors hover:text-link"
              >
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(isLast ? 'font-medium text-foreground' : 'text-muted-foreground')}
                aria-current={isLast ? 'page' : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
