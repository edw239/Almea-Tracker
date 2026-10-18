import type { ReactElement } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { GlobalSearch } from './GlobalSearch'
import { NotificationInbox } from './NotificationInbox'
import { UserMenu } from './UserMenu'

export function TopBar(): ReactElement {
  return (
    <header className="glass-panel sticky top-0 z-30 hidden items-center justify-end gap-2 px-5 py-2.5 md:flex lg:px-8">
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <GlobalSearch compact />
          </span>
        </TooltipTrigger>
        <TooltipContent>Поиск (Ctrl+K)</TooltipContent>
      </Tooltip>
      <NotificationInbox />
      <UserMenu />
    </header>
  )
}
