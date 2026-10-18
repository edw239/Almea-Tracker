import type { ReactElement } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth'
import { LogOut, UserRound } from '../../lib/icons'
import { initialsFromName } from '../../lib/format'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

export function UserMenu(): ReactElement | null {
  const { user, logout } = useAuth()
  if (!user) return null
  const initials = initialsFromName(user.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary text-[10px] font-semibold uppercase text-primary-foreground"
          aria-label="Меню пользователя"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium text-foreground">{user.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/me" className="cursor-pointer">
            <UserRound size={16} strokeWidth={1.5} />
            Мой кабинет
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onSelect={() => {
            void logout()
          }}
        >
          <LogOut size={16} strokeWidth={1.5} />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
