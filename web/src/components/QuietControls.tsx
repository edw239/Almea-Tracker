import { useState, type ButtonHTMLAttributes, type ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { QUIET_ICON } from '../lib/control-styles'
import { Heart, HeartFilled, X } from '../lib/icons'
import { cn } from '../lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'

const ICON_SIZE = 18

const FAVORITE_OFF = 'В избранное'
const FAVORITE_ON = 'Убрать из избранного'

export function FavoriteButton({
  active,
  className,
  onClick,
  ...props
}: { active: boolean } & ButtonHTMLAttributes<HTMLButtonElement>): ReactElement {
  const [pop, setPop] = useState(0)
  const label = active ? FAVORITE_ON : FAVORITE_OFF
  const Icon = active ? HeartFilled : Heart

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          {...props}
          aria-pressed={active}
          aria-label={label}
          className={cn(QUIET_ICON, active && 'text-like hover:text-like', className)}
          onClick={(event) => {
            if (!active) setPop((value) => value + 1)
            onClick?.(event)
          }}
        >
          <Icon
            key={active ? pop : 'off'}
            size={ICON_SIZE}
            className={active && pop > 0 ? 'heart-like' : undefined}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent>{active ? 'В избранном' : FAVORITE_OFF}</TooltipContent>
    </Tooltip>
  )
}

export function QuietClose({
  label = 'Закрыть',
  className,
  to,
  onClick,
}: {
  label?: string
  className?: string
  to?: string
  onClick?: () => void
}): ReactElement {
  const classes = cn(QUIET_ICON, className)
  const icon = <X size={ICON_SIZE} />
  const control = to ? (
    <Link to={to} aria-label={label} className={classes}>
      {icon}
    </Link>
  ) : (
    <button type="button" aria-label={label} className={classes} onClick={onClick}>
      {icon}
    </button>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{control}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
