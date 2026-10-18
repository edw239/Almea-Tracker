import { useEffect, useState, type ReactElement } from 'react'
import { CreateIssueDialog } from '../board/CreateIssueDialog'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'
import { GlobalSearch } from './GlobalSearch'
import { NotificationInbox } from './NotificationInbox'
import { UserMenu } from './UserMenu'

export function TopBar(): ReactElement {
  const [createOpen, setCreateOpen] = useState(false)
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.key === 'c' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setCreateOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <header className="glass-panel sticky top-0 z-30 hidden items-center justify-end gap-2 px-5 py-2.5 md:flex lg:px-8">
      <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
        Создать
      </Button>
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
      <CreateIssueDialog open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  )
}
