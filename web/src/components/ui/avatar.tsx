import type { ReactElement } from 'react'
import { cn } from '../../lib/utils'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarProps {
  name: string
  size?: AvatarSize
  className?: string
  title?: string
}

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

const SIZE_CLASS: Record<AvatarSize, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-8 w-8 text-xs',
  lg: 'h-10 w-10 text-sm',
  xl: 'h-14 w-14 text-lg',
}

export function Avatar({
  name,
  size = 'sm',
  className,
  title,
}: AvatarProps): ReactElement {
  const label = title ?? name

  return (
    <span
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold tracking-wide text-primary-foreground',
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden={!label}
    >
      {initials(name)}
    </span>
  )
}
