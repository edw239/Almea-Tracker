import type { ReactElement, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from '../lib/icons'
import { cn } from '../lib/utils'
import { ContentCard } from './ContentCard'

interface LoadErrorNoticeProps {
  message: string
  onRetry?: () => void
  className?: string
  children?: ReactNode
}

/** Нейтральное оформление ошибки загрузки — без агрессивного красного текста. */
export function LoadErrorNotice({
  message,
  onRetry,
  className,
  children,
}: LoadErrorNoticeProps): ReactElement {
  return (
    <ContentCard
      className={cn('flex items-start gap-3 border-destructive/15 bg-destructive/5', className)}
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive/80" aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm text-foreground">{message}</p>
        {children}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-inset hover:text-foreground"
          >
            <RefreshCw size={14} />
            Повторить
          </button>
        ) : null}
      </div>
    </ContentCard>
  )
}
