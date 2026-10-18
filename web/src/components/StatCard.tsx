import type { ReactElement, ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, type LucideIcon } from '../lib/icons'
import { cn } from '../lib/utils'

interface StatCardProps {
  title: string
  value: string
  icon: LucideIcon
  change?: string
  isPositive?: boolean
}

/** Compact square KPI tile — keep in sync with StatCardSkeleton. */
export const STAT_TILE_CLASS =
  'surface-card flex aspect-square w-[9.5rem] shrink-0 flex-col overflow-hidden p-3.5'

export function StatTiles({ children }: { children: ReactNode }): ReactElement {
  return <div className="flex flex-wrap gap-3">{children}</div>
}

export function StatCard({
  title,
  value,
  icon: Icon,
  change,
  isPositive = true,
}: StatCardProps): ReactElement {
  return (
    <div className={STAT_TILE_CLASS}>
      <div className="flex items-start justify-between gap-1.5">
        <p
          className="min-w-0 text-[0.625rem] font-medium uppercase leading-tight tracking-[0.12em] text-subtle-foreground"
          title={title}
        >
          {title}
        </p>
        {change ? (
          <span
            className={cn(
              'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wider',
              isPositive ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive',
            )}
          >
            {isPositive ? (
              <ArrowUpRight size={11} className="mr-0.5" />
            ) : (
              <ArrowDownRight size={11} className="mr-0.5" />
            )}
            {change}
          </span>
        ) : (
          <Icon size={14} className="mt-0.5 shrink-0 text-subtle-foreground" aria-hidden />
        )}
      </div>
      <p
        className="mt-auto truncate font-display text-[1.75rem] leading-none tracking-[-0.03em] text-foreground"
        title={value}
      >
        {value}
      </p>
    </div>
  )
}
