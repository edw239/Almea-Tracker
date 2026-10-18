import type { LucideIcon } from '../lib/icons'
import {
  BriefcaseBusiness,
  Building2,
  Clock,
  Inbox,
  LayoutGrid,
  Star,
  Users,
} from '../lib/icons'

export type AppUserRole = 'GLOBAL_ADMIN' | 'MEMBER' | string

export type NavCounterKey = 'mineOpen' | 'overdue' | 'unread'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Empty = visible to every authenticated user. */
  roles: AppUserRole[]
  counter?: NavCounterKey
  /** When true, counter uses lemon alert styling if > 0. */
  counterAlert?: boolean
}

export interface NavSection {
  label: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Главное',
    items: [
      {
        to: '/',
        label: 'Моя работа',
        icon: BriefcaseBusiness,
        roles: [],
        counter: 'mineOpen',
      },
      {
        to: '/overview',
        label: 'Обзор',
        icon: LayoutGrid,
        roles: [],
      },
      {
        to: '/overdue',
        label: 'Просрочено',
        icon: Clock,
        roles: [],
        counter: 'overdue',
        counterAlert: true,
      },
      {
        to: '/inbox',
        label: 'Уведомления',
        icon: Inbox,
        roles: [],
        counter: 'unread',
        counterAlert: true,
      },
      {
        to: '/favorites',
        label: 'Избранное',
        icon: Star,
        roles: [],
      },
    ],
  },
  {
    label: 'Компания',
    items: [
      {
        to: '/boards',
        label: 'Доски',
        icon: LayoutGrid,
        roles: [],
      },
      {
        to: '/brands',
        label: 'Бренды',
        icon: Building2,
        roles: [],
      },
      {
        to: '/people',
        label: 'Люди',
        icon: Users,
        roles: ['GLOBAL_ADMIN'],
      },
    ],
  },
]

export function navVisibleForRole(item: NavItem, role: AppUserRole): boolean {
  if (item.roles.length === 0) return true
  return item.roles.includes(role)
}

export { navPathIsActive } from './nav-active'
