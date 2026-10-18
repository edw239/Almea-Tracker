import type { CSSProperties, ReactElement } from 'react'
import { STAT_TILE_CLASS } from '../StatCard'
import { cn } from '../../lib/utils'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

export function Skeleton({ className, style }: SkeletonProps): ReactElement {
  return (
    <div
      className={cn('animate-pulse rounded bg-inset motion-reduce:animate-none', className)}
      style={style}
      aria-hidden
    />
  )
}

export function StatCardSkeleton(): ReactElement {
  return (
    <div className={STAT_TILE_CLASS}>
      <div className="flex items-start justify-between gap-1.5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3.5 w-3.5 shrink-0" />
      </div>
      <Skeleton className="mt-auto h-7 w-10" />
    </div>
  )
}

export function CardSkeleton({ className }: { className?: string }): ReactElement {
  return (
    <div className={cn('surface-card space-y-4 p-5', className)}>
      <div className="flex gap-3">
        <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }: { rows?: number }): ReactElement {
  return (
    <div className="space-y-3 p-5">
      <Skeleton className="h-4 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  )
}

export function PageHeaderSkeleton(): ReactElement {
  return (
    <div className="flex items-start gap-4 border-b border-border/80 pb-7">
      <div className="min-w-0 flex-1 space-y-3">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-24 w-24 shrink-0 rounded sm:h-32 sm:w-32" />
    </div>
  )
}
