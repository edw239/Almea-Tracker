import type { ReactElement, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export interface TabItem {
  id: string
  label: string
  count?: number
  hidden?: boolean
}

interface TabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ items, value, onChange, className }: TabsProps): ReactElement {
  const visible = items.filter((item) => !item.hidden)

  return (
    <div role="tablist" className={cn('flex flex-wrap gap-1 border-b border-border', className)}>
      {visible.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            id={`tab-${item.id}`}
            className={cn(
              'relative -mb-px rounded-t-lg px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:bg-inset hover:text-foreground',
            )}
            onClick={() => onChange(item.id)}
          >
            {item.label}
            {typeof item.count === 'number' ? (
              <span
                className={cn(
                  'ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] tabular-nums',
                  active ? 'bg-primary/15 text-foreground' : 'bg-inset text-muted-foreground',
                )}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

interface TabPanelProps {
  id: string
  activeId: string
  children: ReactNode
  className?: string
}

export function TabPanel({
  id,
  activeId,
  children,
  className,
}: TabPanelProps): ReactElement | null {
  if (id !== activeId) {
    return null
  }
  return (
    <div role="tabpanel" aria-labelledby={`tab-${id}`} className={cn('pt-4', className)}>
      {children}
    </div>
  )
}
