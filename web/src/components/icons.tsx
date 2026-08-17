import type { ComponentType, ReactNode, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { title?: string }

/**
 * Almea Marks — modern bold geometry.
 * Thick solid shapes only. No ornate pictograms.
 */
function IconBase({ title, children, className, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="currentColor"
      stroke="none"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      {...props}
      className={['nav-ico', className].filter(Boolean).join(' ')}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  )
}

/** My work — three bars */
export function IconMyWork(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="5" width="17" height="3.2" rx="1.6" />
      <rect x="3.5" y="10.4" width="12.5" height="3.2" rx="1.6" />
      <rect x="3.5" y="15.8" width="15" height="3.2" rx="1.6" />
    </IconBase>
  )
}

/** Week — four vertical bars */
export function IconWeek(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="4.5" width="3.4" height="15" rx="1.7" />
      <rect x="8.05" y="4.5" width="3.4" height="15" rx="1.7" />
      <rect x="12.6" y="4.5" width="3.4" height="15" rx="1.7" />
      <rect x="17.15" y="4.5" width="3.4" height="15" rx="1.7" />
    </IconBase>
  )
}

/** Overdue — triangle */
export function IconOverdue(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.4 21 19.4H3Z" />
    </IconBase>
  )
}

/** Inbox — open tray from three bars */
export function IconInbox(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.5" y="7" width="3" height="12.5" rx="1.5" />
      <rect x="17.5" y="7" width="3" height="12.5" rx="1.5" />
      <rect x="3.5" y="16.5" width="17" height="3" rx="1.5" />
    </IconBase>
  )
}

/** Favorites — diamond */
export function IconFavorites(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M12 3.2 20.2 12 12 20.8 3.8 12Z" />
    </IconBase>
  )
}

/** Personal — circle */
export function IconSpacePersonal(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="12" r="7.2" />
    </IconBase>
  )
}

/** Ops — rounded square */
export function IconSpaceOps(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.2" y="4.2" width="15.6" height="15.6" rx="2.4" />
    </IconBase>
  )
}

/** Other space — soft pill */
export function IconSpace(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.6" y="7.2" width="16.8" height="9.6" rx="4.8" />
    </IconBase>
  )
}

/** List — three bars */
export function IconList(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="4.5" y="5.2" width="15" height="2.8" rx="1.4" />
      <rect x="4.5" y="10.6" width="15" height="2.8" rx="1.4" />
      <rect x="4.5" y="16" width="10" height="2.8" rx="1.4" />
    </IconBase>
  )
}

/** Logout — bar + arrow */
export function IconLogout(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect x="3.6" y="4.4" width="3.2" height="15.2" rx="1.6" />
      <path d="M10 10.2h5.2V7.6L20.4 12 15.2 16.4v-2.6H10z" />
    </IconBase>
  )
}

/** Collapse */
export function IconChevron(props: IconProps & { direction?: 'left' | 'right' }) {
  const { direction = 'left', ...rest } = props
  return (
    <IconBase {...rest}>
      {direction === 'left' ? (
        <path d="M14.8 5.2 8.4 12l6.4 6.8 1.8-1.7L12 12l4.6-5.1z" />
      ) : (
        <path d="M9.2 5.2 15.6 12l-6.4 6.8-1.8-1.7L12 12 7.4 6.9z" />
      )}
    </IconBase>
  )
}

export function spaceMark(systemKey?: string): ComponentType<IconProps> {
  if (systemKey === 'personal') return IconSpacePersonal
  if (systemKey === 'ops') return IconSpaceOps
  return IconSpace
}
