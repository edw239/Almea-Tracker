import type { ReactElement } from 'react'
import { cn } from '../lib/utils'

export interface AvatarPerson {
  id: string
  full_name: string
}

interface AvatarStackProps {
  people: AvatarPerson[]
  max?: number
  size?: 'sm' | 'md'
  className?: string
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

const SIZE_CLASS = {
  sm: 'h-7 w-7 text-[10px] ring-2',
  md: 'h-8 w-8 text-xs ring-2',
} as const

export function AvatarStack({
  people,
  max = 3,
  size = 'sm',
  className,
}: AvatarStackProps): ReactElement | null {
  if (people.length === 0) return null

  const visible = people.slice(0, max)
  const overflow = people.length - visible.length

  return (
    <div className={cn('flex items-center', className)} aria-label="Участники">
      {visible.map((person, index) => (
        <span
          key={person.id}
          title={person.full_name}
          className={cn(
            'relative inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold tracking-wide text-primary-foreground ring-elevated',
            SIZE_CLASS[size],
            index > 0 && '-ml-1.5',
          )}
          style={{ zIndex: visible.length - index }}
        >
          {initials(person.full_name)}
        </span>
      ))}
      {overflow > 0 ? (
        <span
          className={cn(
            '-ml-1.5 relative inline-flex shrink-0 items-center justify-center rounded-full bg-inset font-semibold text-muted-foreground ring-elevated',
            SIZE_CLASS[size],
          )}
          title={`Ещё ${overflow}`}
        >
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
