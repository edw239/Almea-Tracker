import type { ReactElement, ReactNode } from 'react'
import { MoreHorizontal } from '../lib/icons'
import { cn } from '../lib/utils'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'

interface PageHeaderProps {
  title: string
  overline?: string
  subtitle?: ReactNode
  breadcrumbs?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
  overflow?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  overline,
  subtitle,
  breadcrumbs,
  meta,
  actions,
  toolbar,
  overflow,
  className,
}: PageHeaderProps): ReactElement {
  return (
    <div className={cn('space-y-3 pb-4', className)}>
      {breadcrumbs ? <div className="min-w-0">{breadcrumbs}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {overline ? <p className="label-overline mb-1.5">{overline}</p> : null}
          <h1 className="text-display-lg text-foreground">{title}</h1>
          {subtitle ? (
            <div className="mt-1.5 max-w-[52ch] text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </div>
          ) : null}
          {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {(actions || overflow) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            {overflow ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-inset hover:text-foreground"
                    aria-label="Ещё действия"
                  >
                    <MoreHorizontal size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">{overflow}</DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        )}
      </div>
      {toolbar ? <div className="min-w-0">{toolbar}</div> : null}
    </div>
  )
}
