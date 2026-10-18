import type { HTMLAttributes, ReactElement } from 'react'
import { AlertCircle, Info } from '../../lib/icons'
import { cn } from '../../lib/utils'

export type FormNoticeTone = 'info' | 'error'

interface FormNoticeProps extends HTMLAttributes<HTMLDivElement> {
  tone?: FormNoticeTone
}

const TONE_CLASS: Record<FormNoticeTone, string> = {
  info: 'bg-inset/70 text-foreground',
  error: 'bg-[var(--danger-soft)] text-foreground',
}

export function FormNotice({
  tone = 'info',
  className,
  children,
  ...props
}: FormNoticeProps): ReactElement {
  const Icon = tone === 'error' ? AlertCircle : Info

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex items-start gap-2.5 rounded-[var(--radius-panel)] px-3.5 py-3',
        'animate-in fade-in-0 slide-in-from-top-1',
        TONE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          'mt-0.5 size-4 shrink-0',
          tone === 'error' ? 'text-destructive' : 'text-muted-foreground',
        )}
        aria-hidden
      />
      <div className="min-w-0 text-sm leading-snug">{children}</div>
    </div>
  )
}
