import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { ApiError, api } from '../../lib/api'
import type { BacklogTask, BoardBacklogPayload } from '../../lib/board-types'
import { cn } from '../../lib/utils'

export function BoardBacklogPage() {
  const { boardId = '' } = useParams()
  const [data, setData] = useState<BoardBacklogPayload | null>(null)
  const [title, setTitle] = useState('')
  const [sprintName, setSprintName] = useState('Спринт')
  const [epicId, setEpicId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const [targetSprint, setTargetSprint] = useState('')
  const [pendingStart, setPendingStart] = useState<string | null>(null)
  const [dueFor, setDueFor] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const load = () => api.boardBacklog(boardId).then(setData).catch((caught: unknown) => {
    setError(caught instanceof ApiError ? caught.message : 'Не удалось открыть бэклог')
  })

  useEffect(() => {
    void load()
  }, [boardId])

  useEffect(() => {
    if (!targetSprint && data?.sprints[0]) setTargetSprint(data.sprints[0].id)
  }, [data, targetSprint])

  async function createTask(event: FormEvent) {
    event.preventDefault()
    await api.createBacklogTask(boardId, { title })
    setTitle('')
    await load()
  }

  async function toBoard(taskId: string, dueDate?: string) {
    const view = await api.boardView(boardId)
    const column = view.columns[0]
    if (!column?.id) return
    try {
      await api.moveBoardCard(boardId, taskId, { columnId: column.id, dueDate })
      await load()
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'TASK_DELEGATION_REQUIRES_DUE_DATE') {
        setDueFor(taskId)
        return
      }
      setError(caught instanceof ApiError ? caught.message : 'Не удалось перенести')
    }
  }

  function idsFor(taskId: string) {
    return selected.includes(taskId) ? selected : [taskId]
  }

  function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id
    if (over == null) return
    const taskId = String(event.active.id).replace(/^task:/, '')
    const ids = idsFor(taskId)
    const target = String(over)
    if (target.startsWith('sprint:')) {
      const sprintId = target.slice('sprint:'.length)
      void Promise.all(ids.map((id) => api.updateTask(id, { sprintId: sprintId === 'none' ? null : sprintId }))).then(() => {
        setSelected([])
        return load()
      })
    }
    if (target.startsWith('epic:')) {
      const nextEpic = target.slice('epic:'.length)
      void Promise.all(ids.map((id) => api.updateTask(id, { epicId: nextEpic === 'none' ? null : nextEpic }))).then(() => load())
    }
  }

  const visible = (task: BacklogTask) => !epicId || task.epicId === epicId

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="space-y-6">
        <PageHeader
          overline="Бэклог"
          title="Бэклог"
          toolbar={
            <Button variant="ghost" size="compact" asChild>
              <Link to={`/boards/${boardId}`}>К доске</Link>
            </Button>
          }
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <form className="flex gap-2" onSubmit={(event) => void createTask(event)}>
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Задача в бэклог" required />
          <Button type="submit">Создать</Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={cn('rounded px-2 py-1 text-sm', epicId === '' ? 'bg-primary text-primary-foreground' : 'bg-inset')} onClick={() => setEpicId('')}>
            Все эпики
          </button>
          {data?.epics.map((epic) => (
            <EpicChip key={epic.id} id={epic.id} color={epic.color} active={epicId === epic.id} onClick={() => setEpicId(epic.id)}>
              {epic.key} {epic.title}
            </EpicChip>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">Перетащите задачу на эпик или в спринт. Если отмечено несколько, переносится вся выборка.</p>
        {data?.sprints.map((sprint) => (
          <DropSection key={sprint.id} id={`sprint:${sprint.id}`} title={`${sprint.name} · ${sprint.state} · ${sprint.points} очков`}>
            {sprint.tasks.filter(visible).map((task) => (
              <BacklogRow key={task.id} task={task} onBoard={() => void toBoard(task.id)} />
            ))}
            {sprint.state === 'FUTURE' ? (
              <Button type="button" size="sm" onClick={() => void api.startSprint(sprint.id, false).then(() => load()).catch((caught: unknown) => {
                if (caught instanceof ApiError && caught.code === 'SPRINT_START_NEEDS_DUE') {
                  setError(caught.message)
                  setPendingStart(sprint.id)
                }
              })}>
                Начать спринт
              </Button>
            ) : null}
          </DropSection>
        ))}
        <DropSection id="sprint:none" title="Бэклог">
          {data?.tasks.filter(visible).map((task) => (
            <BacklogRow
              key={task.id}
              task={task}
              selected={selected.includes(task.id)}
              onToggle={() => setSelected((current) => current.includes(task.id) ? current.filter((id) => id !== task.id) : [...current, task.id])}
              onBoard={() => void toBoard(task.id)}
            />
          ))}
          {selected.length > 0 && data && data.sprints.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Спринт для выбранных" className="h-9 rounded bg-inset px-2 text-sm" value={targetSprint} onChange={(event) => setTargetSprint(event.target.value)}>
                {data.sprints.map((sprint) => (
                  <option key={sprint.id} value={sprint.id}>{sprint.name}</option>
                ))}
              </select>
              <Button
                type="button"
                onClick={() => void Promise.all(selected.map((id) => api.updateTask(id, { sprintId: targetSprint }))).then(() => { setSelected([]); return load() })}
              >
                Выбранные в спринт ({selected.length})
              </Button>
            </div>
          ) : null}
        </DropSection>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void api.createSprint(boardId, { name: sprintName }).then(() => load()) }}>
          <Input value={sprintName} onChange={(event) => setSprintName(event.target.value)} aria-label="Спринт" />
          <Button type="submit">Создать спринт</Button>
        </form>
        {pendingStart ? (
          <Button type="button" onClick={() => void api.startSprint(pendingStart, true).then(() => { setPendingStart(null); return load() })}>
            Поставить срок конца спринта и начать
          </Button>
        ) : null}
        {dueFor ? (
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); const id = dueFor; setDueFor(null); void toBoard(id, due) }}>
            <p>Укажите срок</p>
            <Input type="date" value={due} onChange={(event) => setDue(event.target.value)} required />
            <Button type="submit">Перенести на доску</Button>
          </form>
        ) : null}
      </div>
    </DndContext>
  )
}

function DropSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section ref={setNodeRef} className={cn('space-y-2 rounded p-2', isOver && 'ring-2 ring-primary/40')}>
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  )
}

function EpicChip({
  id,
  color,
  active,
  onClick,
  children,
}: {
  id: string
  color: string
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `epic:${id}` })
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn('rounded px-2 py-1 text-sm text-white', (active || isOver) && 'ring-2 ring-foreground')}
      style={{ background: color }}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function BacklogRow({
  task,
  selected,
  onToggle,
  onBoard,
}: {
  task: BacklogTask
  selected?: boolean
  onToggle?: () => void
  onBoard: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `task:${task.id}` })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('flex items-center gap-3 rounded bg-surface px-3 py-2 text-sm', isDragging && 'opacity-60')}
    >
      {onToggle ? <input type="checkbox" checked={Boolean(selected)} onChange={onToggle} aria-label={`Выбрать ${task.key}`} /> : null}
      <span className="cursor-grab text-muted-foreground" {...listeners} {...attributes}>{task.key}</span>
      <span className="flex-1">{task.title}</span>
      {task.epicTitle ? <span className="text-xs">{task.epicTitle}</span> : null}
      <span>{task.storyPoints ?? '—'}</span>
      <Button type="button" size="compact" variant="ghost" onClick={onBoard}>На доску</Button>
    </div>
  )
}
