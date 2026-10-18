import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BoardCanvas } from '../../components/board/BoardCanvas'
import { CreateIssueDialog } from '../../components/board/CreateIssueDialog'
import { PageHeader } from '../../components/PageHeader'
import { TaskPanel } from '../../components/TaskPanel'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ApiError, api } from '../../lib/api'
import type { BoardCard, BoardViewPayload } from '../../lib/board-types'
import { TASK_KEY_PATTERN } from '../../lib/space-key'
import { useStore } from '../../store'

const REFRESH_MS = 30_000

export function BoardPage() {
  const { boardId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const [view, setView] = useState<BoardViewPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [mine, setMine] = useState(false)
  const [recent, setRecent] = useState(false)
  const [quick, setQuick] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [collapsed, setCollapsed] = useState<string[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [help, setHelp] = useState(false)
  const [finishOpen, setFinishOpen] = useState(false)
  const [finishName, setFinishName] = useState('')
  const [dueFor, setDueFor] = useState<{ taskId: string; columnId: string; laneKey: string; beforeId: string | null; afterId: string | null } | null>(null)
  const [due, setDue] = useState('')
  const selectedId = params.get('task')
  const cursor = Number(params.get('cursor') ?? '0')

  const load = useCallback(async () => {
    try {
      const next = await api.boardView(boardId, {
        q: query || undefined,
        mine: mine ? '1' : undefined,
        recent: recent ? '1' : undefined,
        quick: quick || undefined,
        assigneeId: assigneeId || undefined,
      })
      setView(next)
      setError(null)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось открыть доску')
    }
  }, [assigneeId, boardId, mine, query, quick, recent])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => void load(), REFRESH_MS)
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onFocus)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onFocus)
    }
  }, [load])

  const cards = (view?.cards ?? []).filter((card) => !collapsed.includes(card.columnId))
  const selected = store.tasks.find((task) => task.id === selectedId)

  useEffect(() => {
    if (!selectedId) return
    void store.ensureTask(selectedId)
  }, [selectedId, store.ensureTask])

  const openTask = (id: string) => {
    void store.ensureTask(id)
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('task', id)
      return next
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (event.key === '/') {
        event.preventDefault()
        document.getElementById('board-search')?.focus()
      } else if (event.key === '?' ) {
        setHelp((value) => !value)
      } else if (event.key === 'Escape') {
        setParams((prev) => {
          const next = new URLSearchParams(prev)
          next.delete('task')
          return next
        })
      } else if (event.key === 'j' || event.key === 'k') {
        const list = view?.cards ?? []
        if (list.length === 0) return
        const next = event.key === 'j' ? Math.min(cursor + 1, list.length - 1) : Math.max(cursor - 1, 0)
        setParams((prev) => {
          const paramsNext = new URLSearchParams(prev)
          paramsNext.set('cursor', String(next))
          return paramsNext
        })
      } else if (event.key === 'i' || event.key === 'Enter') {
        const card = view?.cards[cursor]
        if (card) openTask(card.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, setParams, view?.cards])

  async function move(taskId: string, columnId: string, laneKey: string, beforeId: string | null, afterId: string | null, dueDate?: string) {
    const previous = view
    setView((current) =>
      current
        ? {
            ...current,
            cards: current.cards.map((card) =>
              card.id === taskId ? { ...card, columnId, laneKey } : card,
            ),
          }
        : current,
    )
    try {
      await api.moveBoardCard(boardId, taskId, { columnId, laneKey, beforeId, afterId, dueDate })
      await load()
    } catch (caught) {
      setView(previous)
      if (caught instanceof ApiError && caught.code === 'TASK_DELEGATION_REQUIRES_DUE_DATE') {
        setDueFor({ taskId, columnId, laneKey, beforeId, afterId })
        return
      }
      setError(caught instanceof ApiError ? caught.message : 'Не удалось перенести карточку')
    }
  }

  return (
    <div className={selected ? 'with-panel' : undefined}>
      <div className="space-y-4">
        <PageHeader
          overline={view?.board.type === 'SCRUM' ? 'Спринт' : 'Доска'}
          title={view?.board.name ?? 'Доска'}
          subtitle={
            view?.activeSprint
              ? `${view.activeSprint.name}${view.activeSprint.goal ? ` — ${view.activeSprint.goal}` : ''}${view.activeSprint.daysLeft != null ? ` · ${view.activeSprint.daysLeft} дн.` : ''}`
              : view?.board.type === 'SCRUM'
                ? 'Нет активного спринта'
                : undefined
          }
          toolbar={
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="ghost" size="compact" asChild>
                <Link to={`/boards/${boardId}/backlog`}>Бэклог</Link>
              </Button>
              <Button type="button" variant="ghost" size="compact" asChild>
                <Link to={`/boards/${boardId}/reports`}>Отчёты</Link>
              </Button>
              <Button type="button" variant="ghost" size="compact" asChild>
                <Link to={`/boards/${boardId}/settings`}>Настройки</Link>
              </Button>
              {view?.activeSprint ? (
                <Button type="button" size="compact" onClick={() => setFinishOpen(true)}>
                  Завершить спринт
                </Button>
              ) : null}
            </div>
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {view?.truncated ? <p className="text-sm text-muted-foreground">Показаны не все карточки.</p> : null}
        <div className="flex flex-wrap items-center gap-2">
          <Input id="board-search" placeholder="Поиск" value={query} onChange={(event) => setQuery(event.target.value)} className="max-w-xs" />
          <Button type="button" variant={mine ? 'secondary' : 'ghost'} size="compact" onClick={() => setMine((value) => !value)}>
            Только мои задачи
          </Button>
          <Button type="button" variant={recent ? 'secondary' : 'ghost'} size="compact" onClick={() => setRecent((value) => !value)}>
            Недавно обновлённые
          </Button>
          {view?.quickFilters.map((filter) => (
            <Button
              key={filter.id}
              type="button"
              variant={quick === filter.id ? 'secondary' : 'ghost'}
              size="compact"
              onClick={() => setQuick((current) => (current === filter.id ? '' : filter.id))}
            >
              {filter.name}
            </Button>
          ))}
          {store.users.map((user) => (
            <button
              key={user.id}
              type="button"
              className={`rounded-full px-2 py-1 text-xs ${assigneeId === user.id ? 'bg-primary text-primary-foreground' : 'bg-inset'}`}
              onClick={() => setAssigneeId((current) => (current === user.id ? '' : user.id))}
            >
              {user.initials}
            </button>
          ))}
          <SelectSwimlane value={view?.board.swimlaneBy ?? 'NONE'} onChange={(swimlaneBy) => void api.updateBoard(boardId, { swimlaneBy }).then(() => load())} />
          {view?.columns.map((column) => (
            <button key={column.id} type="button" className="text-xs text-muted-foreground" onClick={() => setCollapsed((current) => current.includes(column.id ?? '') ? current.filter((id) => id !== column.id) : [...current, column.id ?? ''])}>
              {collapsed.includes(column.id ?? '') ? `Показать ${column.name}` : `Свернуть ${column.name}`}
            </button>
          ))}
        </div>
        {help ? (
          <p className="text-sm text-muted-foreground">c создать · / поиск · j/k карточки · i открыть · Esc закрыть · ? справка</p>
        ) : null}
        {view ? (
          <BoardCanvas
            columns={view.columns.filter((column) => !collapsed.includes(column.id ?? ''))}
            lanes={view.lanes}
            cards={cards}
            colorBy={view.board.cardColorBy}
            extraFields={cardFieldsOf(view.board.cardFields)}
            selectedId={selectedId ?? view.cards[cursor]?.id ?? null}
            onOpen={openTask}
            onCreate={() => setCreateOpen(true)}
            onMove={(taskId, columnId, laneKey, beforeId, afterId) => void move(taskId, columnId, laneKey, beforeId, afterId)}
          />
        ) : null}
      </div>
      {selected ? <TaskPanel task={selected} onClose={() => openTaskClose(setParams)} /> : null}
      <CreateIssueDialog open={createOpen} onOpenChange={setCreateOpen} />
      {finishOpen && view?.activeSprint ? (
        <form
          className="fixed bottom-4 left-4 z-50 w-80 space-y-2 rounded bg-elevated p-4 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault()
            const sprintId = view.activeSprint?.id
            if (!sprintId) return
            const body = finishName.trim()
              ? { unfinishedTo: 'sprint' as const, createSprint: { name: finishName.trim() } }
              : { unfinishedTo: 'backlog' as const }
            setFinishOpen(false)
            void api.completeSprint(sprintId, body).then(() => load())
          }}
        >
          <p className="text-sm font-medium">Завершить спринт</p>
          <Input
            placeholder="Имя нового спринта или пусто — в бэклог"
            value={finishName}
            onChange={(event) => setFinishName(event.target.value)}
          />
          <Button type="submit" size="sm">Завершить</Button>
        </form>
      ) : null}
      {dueFor ? (
        <form
          className="fixed bottom-4 right-4 z-50 w-80 space-y-2 rounded bg-elevated p-4 shadow-lg"
          onSubmit={(event) => {
            event.preventDefault()
            const pending = dueFor
            setDueFor(null)
            void move(pending.taskId, pending.columnId, pending.laneKey, pending.beforeId, pending.afterId, due)
          }}
        >
          <p className="text-sm font-medium">Укажите срок</p>
          <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required />
          <Button type="submit" size="sm">Перенести</Button>
        </form>
      ) : null}
    </div>
  )
}

function cardFieldsOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  return value.filter((item): item is string => typeof item === 'string').slice(0, 3)
}

function openTaskClose(setParams: ReturnType<typeof useSearchParams>[1]) {
  setParams((prev) => {
    const next = new URLSearchParams(prev)
    next.delete('task')
    return next
  })
}

function SelectSwimlane({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select aria-label="Дорожки" className="h-8 rounded bg-inset px-2 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="NONE">Без дорожек</option>
      <option value="ASSIGNEE">Исполнитель</option>
      <option value="EPIC">Эпик</option>
      <option value="BRAND">Бренд</option>
      <option value="PRIORITY">Приоритет</option>
      <option value="QUERIES">Запросы</option>
    </select>
  )
}

export function keyLooksLikeIssue(value: string): boolean {
  return TASK_KEY_PATTERN.test(value.trim().toUpperCase())
}

export type { BoardCard }
