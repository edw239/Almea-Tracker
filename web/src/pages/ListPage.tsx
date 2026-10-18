import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BoardView } from '../components/BoardView'
import { EmptyState } from '../components/EmptyState'
import { LoadErrorNotice } from '../components/LoadErrorNotice'
import { PageHeader } from '../components/PageHeader'
import { PageToolbar } from '../components/PageToolbar'
import { Select } from '../components/Select'
import { TaskPanel } from '../components/TaskPanel'
import { Avatars, QuickAdd, StatusChip, TaskRow } from '../components/ui'
import { Button } from '../components/ui/button'
import { CardSkeleton } from '../components/ui/Skeleton'
import { useConfirm } from '../hooks/useConfirm'
import { ApiError, api } from '../lib/api'
import {
  buildListFilters,
  EMPTY_FILTER,
  filtersToQuery,
  hasActiveFilters,
  parseFiltersToDraft,
  type FilterDraft,
} from '../lib/filters'
import { byPosition, formatDay, formatMonthYear, isoDate, monthGrid, startOfDay, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import { groupTasks, type GroupBy } from '../lib/mechanics'
import { boardColumns, resolveStatusesForList } from '../lib/status'
import { FILTER_TOKEN, SEGMENT_TRACK, segmentItemClass } from '../lib/control-styles'
import { ListTodo } from '../lib/icons'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import type { ListStatus, Task, TaskPriority, TaskStatus, ViewType } from '../types'

const VIEWS: { id: ViewType; label: string }[] = [
  { id: 'LIST', label: 'Список' },
  { id: 'BOARD', label: 'Доска' },
  { id: 'TABLE', label: 'Таблица' },
  { id: 'CALENDAR', label: 'Календарь' },
]

const GROUP_OPTIONS: { id: GroupBy; label: string }[] = [
  { id: 'NONE', label: 'Без групп' },
  { id: 'STATUS', label: 'Статус' },
  { id: 'PRIORITY', label: 'Приоритет' },
  { id: 'ASSIGNEE', label: 'Исполнитель' },
  { id: 'DUE_DATE', label: 'Срок' },
]

type SavedView = {
  id: string
  name: string
  viewType: ViewType
  groupBy: string
  filters: unknown
  isShared: boolean
  ownerId: string
}

type TemplateRow = { id: string; name: string }
type ScheduleRow = {
  id: string
  title: string
  frequency: string
  nextRunAt: string
  isActive: boolean
}

export function ListPage() {
  const { listId } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
  const { confirm, prompt } = useConfirm()
  const list = store.lists.find((item) => item.id === listId)
  const view = (params.get('view') as ViewType | null) ?? 'LIST'
  const selectedId = params.get('task')
  const [groupBy, setGroupBy] = useState<GroupBy>('NONE')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filterDraft, setFilterDraft] = useState<FilterDraft>(EMPTY_FILTER)
  const [appliedFilters, setAppliedFilters] = useState<string | undefined>()
  const [savedViews, setSavedViews] = useState<SavedView[]>([])
  const [activeViewId, setActiveViewId] = useState('')
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [schedules, setSchedules] = useState<ScheduleRow[]>([])
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [statusEditorOpen, setStatusEditorOpen] = useState(false)

  const reportError = useCallback((error: unknown, fallback: string) => {
    setActionError(error instanceof ApiError ? error.message : fallback)
  }, [])

  const reloadExtras = useCallback(async (id: string) => {
    const [views, tpls, scheds] = await Promise.all([
      api.listViews(id).catch(() => []),
      api.listTemplates(id).catch(() => []),
      api.listSchedules(id).catch(() => []),
    ])
    setSavedViews(views)
    setTemplates(tpls.map((item) => ({ id: item.id, name: item.name })))
    setSchedules(
      scheds.map((item) => ({
        id: item.id,
        title: item.title,
        frequency: item.frequency,
        nextRunAt: item.nextRunAt,
        isActive: item.isActive,
      })),
    )
  }, [])

  useEffect(() => {
    if (!listId) return
    void store.ensureList(listId, appliedFilters)
    void api
      .getViewPreference(listId)
      .then((pref) => {
        if (pref?.groupBy && GROUP_OPTIONS.some((item) => item.id === pref.groupBy)) {
          setGroupBy(pref.groupBy as GroupBy)
        }
      })
      .catch(() => undefined)
    void reloadExtras(listId)
  }, [appliedFilters, listId, reloadExtras, store.ensureList])

  const openTask = useCallback(
    (id: string) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('task', id)
        return next
      })
    },
    [setParams],
  )

  const closeTask = useCallback(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('task')
      return next
    })
  }, [setParams])

  const setViewType = useCallback(
    (nextView: ViewType) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('view', nextView)
        return next
      })
    },
    [setParams],
  )

  const applySavedView = useCallback(
    (saved: SavedView) => {
      setActiveViewId(saved.id)
      const nextGroup = GROUP_OPTIONS.some((item) => item.id === saved.groupBy)
        ? (saved.groupBy as GroupBy)
        : 'NONE'
      setGroupBy(nextGroup)
      setViewType(saved.viewType)
      const draft = parseFiltersToDraft(saved.filters)
      setFilterDraft(draft)
      setAppliedFilters(filtersToQuery(saved.filters) ?? buildListFilters(draft))
      if (listId) {
        void api.putViewPreference({
          listId,
          viewType: saved.viewType,
          groupBy: nextGroup,
          filters: saved.filters ?? undefined,
        })
      }
    },
    [listId, setViewType],
  )

  const saveCurrentView = useCallback(async () => {
    if (!listId) return
    const name = await prompt({
      title: 'Сохранить вид',
      description: 'Как назвать сохранённый вид?',
      confirmLabel: 'Сохранить',
      placeholder: 'Название вида',
    })
    if (!name?.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      let filters: unknown
      if (appliedFilters) {
        try {
          filters = JSON.parse(appliedFilters)
        } catch {
          filters = undefined
        }
      }
      await api.createView({
        listId,
        name: name.trim(),
        viewType: view,
        groupBy,
        isShared: false,
        filters,
      })
      await reloadExtras(listId)
    } catch (error) {
      reportError(error, 'Не удалось сохранить вид')
    } finally {
      setBusy(false)
    }
  }, [appliedFilters, groupBy, listId, prompt, reloadExtras, reportError, view])

  const deleteActiveView = useCallback(async () => {
    if (!listId || !activeViewId) return
    const ok = await confirm({
      title: 'Удалить сохранённый вид?',
      description: 'Вид исчезнет у всех, кому он был доступен.',
      confirmLabel: 'Удалить',
      destructive: true,
    })
    if (!ok) return
    setBusy(true)
    setActionError(null)
    try {
      await api.deleteView(activeViewId)
      setActiveViewId('')
      await reloadExtras(listId)
    } catch (error) {
      reportError(error, 'Не удалось удалить вид')
    } finally {
      setBusy(false)
    }
  }, [activeViewId, confirm, listId, reloadExtras, reportError])

  const createFromTemplate = useCallback(
    async (templateId: string) => {
      if (!listId || !templateId) return
      setBusy(true)
      setActionError(null)
      try {
        await api.createFromTemplate(listId, templateId)
        await store.ensureList(listId, appliedFilters)
      } catch (error) {
        reportError(error, 'Не удалось создать задачи из шаблона')
      } finally {
        setBusy(false)
      }
    },
    [appliedFilters, listId, reportError, store],
  )

  const createWeeklySchedule = useCallback(async () => {
    if (!listId) return
    const title = await prompt({
      title: 'Новое расписание',
      description: 'Название еженедельного пакета задач.',
      confirmLabel: 'Создать',
      defaultValue: 'Еженедельный пакет',
      placeholder: 'Название расписания',
    })
    if (!title?.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dubai'
      await api.createSchedule(listId, {
        title: title.trim(),
        frequency: 'WEEKLY',
        byWeekday: 1,
        atMinute: 9 * 60,
        timezone,
        templateId: templates[0]?.id,
        dueInDays: 2,
      })
      await reloadExtras(listId)
    } catch (error) {
      reportError(error, 'Не удалось создать расписание')
    } finally {
      setBusy(false)
    }
  }, [listId, prompt, reloadExtras, reportError, templates])

  const toggleSchedule = useCallback(
    async (scheduleId: string, isActive: boolean) => {
      setBusy(true)
      setActionError(null)
      try {
        await api.updateSchedule(scheduleId, { isActive: !isActive })
        if (listId) await reloadExtras(listId)
      } catch (error) {
        reportError(error, 'Не удалось обновить расписание')
      } finally {
        setBusy(false)
      }
    },
    [listId, reloadExtras, reportError],
  )

  const tasks = useMemo(() => {
    if (!list) return []
    return store.tasks.filter((task) => task.listId === list.id && !task.parentTaskId).sort(byPosition)
  }, [list, store.tasks])

  const statuses = list ? resolveStatusesForList(store, list.id) : []
  const groups = useMemo(
    () =>
      groupTasks(tasks, groupBy, (id) => statuses.find((item) => item.id === id)?.name ?? 'Статус'),
    [groupBy, statuses, tasks],
  )

  if (!list) {
    return store.ready ? (
      <EmptyState icon={ListTodo} title="Список не найден" description="Проверьте ссылку или права доступа." />
    ) : (
      <CardSkeleton />
    )
  }

  const selected = store.tasks.find((task) => task.id === selectedId)
  const starred = store.favorites.some((item) => item.entityType === 'TASK_LIST' && item.entityId === list.id)
  const personal = list.systemKey === 'personal-inbox'
  const empty = tasks.length === 0

  const listToolbar = (
    <PageToolbar
      leading={
        <div className={cn(SEGMENT_TRACK, 'p-0.5')} role="tablist" aria-label="Вид списка">
          {VIEWS.map((item) => {
            const next = new URLSearchParams(params)
            next.set('view', item.id)
            return (
              <Link
                key={item.id}
                to={`/lists/${list.id}?${next}`}
                role="tab"
                aria-selected={view === item.id}
                className={segmentItemClass(view === item.id)}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      }
      trailing={
        <>
          <Select
            variant="toolbar"
            aria-label="Группировка"
            value={groupBy}
            options={GROUP_OPTIONS.map((item) => ({ value: item.id, label: item.label }))}
            onChange={(next) => {
              setGroupBy(next)
              void api.putViewPreference({ listId: list.id, groupBy: next, viewType: view })
            }}
          />
          <Select
            variant="toolbar"
            aria-label="Сохранённые виды"
            value={activeViewId}
            disabled={busy}
            placeholder="Виды…"
            options={[
              { value: '', label: 'Виды…' },
              ...savedViews.map((item) => ({
                value: item.id,
                label: `${item.name}${item.isShared ? ' · shared' : ''}`,
              })),
            ]}
            onChange={(id) => {
              if (!id) {
                setActiveViewId('')
                return
              }
              const saved = savedViews.find((item) => item.id === id)
              if (saved) applySavedView(saved)
            }}
          />
          <Button type="button" variant="ghost" size="compact" disabled={busy} onClick={() => void saveCurrentView()}>
            Сохранить вид
          </Button>
          {activeViewId ? (
            <Button type="button" variant="ghost" size="compact" disabled={busy} onClick={() => void deleteActiveView()}>
              Удалить вид
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="compact" onClick={() => void store.toggleFavorite('TASK_LIST', list.id)}>
            {starred ? 'В избранном' : 'В избранное'}
          </Button>
          <Button type="button" variant="ghost" size="compact" onClick={() => setStatusEditorOpen(true)}>
            Колонки
          </Button>
        </>
      }
    />
  )

  return (
    <div className={selected ? 'with-panel' : undefined}>
      <div className="space-y-4">
        <PageHeader
          overline="List"
          title={list.name}
          subtitle={
            personal
              ? 'Личный захват. Пока вы исполнитель — задача видна в Моей работе.'
              : 'Единица работы. Создайте задачу, откройте карточку или перетащите на доске.'
          }
          toolbar={listToolbar}
        />
        {store.error || actionError ? (
          <LoadErrorNotice message={store.error ?? actionError ?? ''} />
        ) : null}
        {statusEditorOpen ? (
          <StatusEditorPanel
            listId={list.id}
            statuses={statuses}
            onClose={() => setStatusEditorOpen(false)}
            onChanged={() => void store.refreshListStatuses(list.id)}
          />
        ) : null}
        <div className="space-y-4">
          <PageToolbar
            secondary={
              appliedFilters ? (
                <span className={cn(FILTER_TOKEN, 'px-2.5')}>Фильтр активен</span>
              ) : null
            }
          >
            <form
              className="flex min-w-0 flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault()
                const next = buildListFilters(filterDraft)
                setAppliedFilters(next)
                setActiveViewId('')
                void api.putViewPreference({
                  listId: list.id,
                  viewType: view,
                  groupBy,
                  filters: next ? JSON.parse(next) : null,
                })
              }}
            >
            <Select
              variant="toolbar"
              aria-label="Статус"
              value={filterDraft.status}
              placeholder="Статус"
              options={[
                { value: '', label: 'Статус' },
                ...(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => ({
                  value: key,
                  label: STATUS_LABEL[key],
                })),
              ]}
              onChange={(status) => setFilterDraft((prev) => ({ ...prev, status: status as TaskStatus | '' }))}
            />
            <Select
              variant="toolbar"
              aria-label="Приоритет"
              value={filterDraft.priority}
              placeholder="Приоритет"
              options={[
                { value: '', label: 'Приоритет' },
                ...(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => ({
                  value: key,
                  label: PRIORITY_LABEL[key],
                })),
              ]}
              onChange={(priority) =>
                setFilterDraft((prev) => ({ ...prev, priority: priority as TaskPriority | '' }))
              }
            />
            <Select
              variant="toolbar"
              aria-label="Исполнитель"
              value={filterDraft.assigneeId}
              placeholder="Исполнитель"
              options={[
                { value: '', label: 'Исполнитель' },
                ...store.users.map((user) => ({ value: user.id, label: user.name })),
              ]}
              onChange={(assigneeId) => setFilterDraft((prev) => ({ ...prev, assigneeId }))}
            />
            <input
              aria-label="Название"
              placeholder="Название содержит…"
              value={filterDraft.title}
              onChange={(event) => setFilterDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
            <Button type="submit" size="sm">
              Фильтр
            </Button>
            {hasActiveFilters(filterDraft) || appliedFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="compact"
                onClick={() => {
                  setFilterDraft(EMPTY_FILTER)
                  setAppliedFilters(undefined)
                  setActiveViewId('')
                  void api.putViewPreference({
                    listId: list.id,
                    viewType: view,
                    groupBy,
                    filters: null,
                  })
                }}
              >
                Сбросить
              </Button>
            ) : null}
            </form>
          </PageToolbar>

          <div className="template-bar">
            <Select
              variant="toolbar"
              aria-label="Шаблон"
              value=""
              disabled={busy || templates.length === 0}
              placeholder={templates.length ? 'Создать из шаблона…' : 'Нет шаблонов'}
              options={templates.map((item) => ({ value: item.id, label: item.name }))}
              onChange={(templateId) => {
                if (templateId) void createFromTemplate(templateId)
              }}
            />
            <button type="button" className="ghost" disabled={busy} onClick={() => void createWeeklySchedule()}>
              + Расписание (пн 09:00)
            </button>
          </div>

          {schedules.length > 0 ? (
            <div className="schedule-bar">
              {schedules.map((item) => (
                <div key={item.id} className="schedule-chip">
                  <span>
                    {item.title} · {item.frequency}
                    {item.isActive ? '' : ' (выкл)'} · след. {formatDay(item.nextRunAt)}
                  </span>
                  <button
                    type="button"
                    className="ghost"
                    disabled={busy}
                    onClick={() => void toggleSchedule(item.id, item.isActive)}
                  >
                    {item.isActive ? 'Выкл' : 'Вкл'}
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {selectedIds.length > 0 ? (
            <div className="bulk-bar">
              <span>Выбрано: {selectedIds.length}</span>
              <button
                type="button"
                className="ghost"
                onClick={() => void store.bulkUpdate(selectedIds, { status: 'DONE' }).then(() => setSelectedIds([]))}
              >
                В готово
              </button>
              <button type="button" className="ghost" onClick={() => setSelectedIds([])}>
                Снять
              </button>
            </div>
          ) : null}

          {empty ? (
            <EmptyState
              icon={ListTodo}
              title={appliedFilters ? 'Нет задач по фильтру' : 'В списке пока пусто'}
              description={
                appliedFilters
                  ? 'Сбросьте фильтр или измените условия.'
                  : 'Добавьте задачу или разверните шаблон.'
              }
            />
          ) : null}

          {view === 'LIST' ? (
            <>
              {groups.map((group) => (
                <section className="group" key={group.key}>
                  {groupBy !== 'NONE' ? (
                    <div className="group-h">
                      <h2>{group.label}</h2>
                      <span>{group.tasks.length}</span>
                    </div>
                  ) : null}
                  <div className="card-list">
                    {group.tasks.map((task, index) => (
                      <div key={task.id} className="task-row-wrap">
                        <label className="bulk-check">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(task.id)}
                            onChange={(event) => {
                              setSelectedIds((prev) =>
                                event.target.checked ? [...prev, task.id] : prev.filter((id) => id !== task.id),
                              )
                            }}
                          />
                        </label>
                        <TaskRow task={task} active={task.id === selectedId} onOpen={() => openTask(task.id)} />
                        {index > 0 ? (
                          <button
                            type="button"
                            className="ghost compact"
                            title="Переместить выше"
                            onClick={() => void store.moveTask(task.id, group.tasks[index - 2]?.id ?? null)}
                          >
                            ↑
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              <QuickAdd
                listId={list.id}
                placeholder={personal ? 'Захватить во входящие…' : 'Быстрая задача в этот список…'}
                onCreated={openTask}
              />
            </>
          ) : null}
          {view === 'BOARD' ? (
            <>
              <BoardView columns={boardColumns(statuses)} tasks={tasks} selectedId={selectedId} onOpen={openTask} />
              <QuickAdd listId={list.id} placeholder="Карточка в первую колонку…" onCreated={openTask} />
            </>
          ) : null}
          {view === 'TABLE' ? <TableView tasks={tasks} statuses={statuses} onOpen={openTask} /> : null}
          {view === 'CALENDAR' ? <CalendarView onOpen={openTask} listId={list.id} /> : null}
        </div>
      </div>
      {selected ? <TaskPanel task={selected} onClose={closeTask} /> : null}
    </div>
  )
}

function TableView({
  tasks,
  statuses,
  onOpen,
}: {
  tasks: Task[]
  statuses: ReturnType<typeof resolveStatusesForList>
  onOpen: (id: string) => void
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Задача</th>
            <th>Колонка</th>
            <th>Приоритет</th>
            <th>Срок</th>
            <th>Люди</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} className="clickable" onClick={() => onOpen(task.id)}>
              <td>{task.title}</td>
              <td>
                <StatusChip task={task} statuses={statuses} />
              </td>
              <td>{task.priority}</td>
              <td>{task.dueDate ?? '—'}</td>
              <td>
                <Avatars ids={task.assigneeIds} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function CalendarView({ listId, onOpen }: { listId: string; onOpen: (id: string) => void }) {
  const store = useStore()
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()))
  const days = useMemo(() => monthGrid(anchor), [anchor])
  const today = isoDate(startOfDay(new Date()))
  const tasks = store.tasks.filter((task) => task.listId === listId && task.dueDate)
  const heads = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
  const month = anchor.getMonth()

  return (
    <div>
      <div className="top-actions" style={{ marginBottom: 12 }}>
        <button
          type="button"
          className="ghost"
          aria-label="Предыдущий месяц"
          onClick={() => setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
        >
          ←
        </button>
        <strong>{formatMonthYear(anchor)}</strong>
        <button
          type="button"
          className="ghost"
          aria-label="Следующий месяц"
          onClick={() => setAnchor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
        >
          →
        </button>
        <button type="button" className="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>
          Сегодня
        </button>
      </div>
      <div className="calendar">
        {heads.map((head) => (
          <div className="cal-head" key={head}>
            {head}
          </div>
        ))}
        {days.map((day) => {
          const key = isoDate(day)
          const items = tasks.filter((task) => task.dueDate === key)
          return (
            <div key={key} className={`cal-cell ${day.getMonth() !== month ? 'out' : ''} ${key === today ? 'today' : ''}`}>
              <div className="cal-day">{formatDay(key)}</div>
              {items.map((task) => (
                <button key={task.id} type="button" className="cal-task" onClick={() => onOpen(task.id)}>
                  {task.title}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusEditorPanel({
  listId,
  statuses,
  onClose,
  onChanged,
}: {
  listId: string
  statuses: ListStatus[]
  onClose: () => void
  onChanged: () => void
}) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#64748b')
  const [category, setCategory] = useState<TaskStatus>('OPEN')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function createStatus(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError(null)
    try {
      await api.createListStatus(listId, { name: name.trim(), color, category })
      setName('')
      onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось создать колонку')
    } finally {
      setPending(false)
    }
  }

  async function saveStatus(status: ListStatus, patch: Partial<{ name: string; color: string; category: TaskStatus }>) {
    setPending(true)
    setError(null)
    try {
      await api.updateListStatus(status.id, patch)
      onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось сохранить')
    } finally {
      setPending(false)
    }
  }

  async function removeStatus(status: ListStatus) {
    const others = statuses.filter((item) => item.id !== status.id)
    if (others.length === 0) {
      setError('Нельзя удалить последнюю колонку')
      return
    }
    setPending(true)
    setError(null)
    try {
      await api.deleteListStatus(status.id, others[0]?.id)
      onChanged()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Не удалось удалить')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="me-panel" style={{ margin: '0 24px 16px' }}>
      <div className="group-h">
        <h2>Колонки списка</h2>
        <button type="button" className="ghost" onClick={onClose}>
          Закрыть
        </button>
      </div>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="card-list">
        {statuses.map((status) => (
          <div key={status.id} className="task-row" style={{ display: 'grid', gap: 8 }}>
            <input
              defaultValue={status.name}
              aria-label="Название колонки"
              disabled={pending}
              onBlur={(event) => {
                const next = event.target.value.trim()
                if (next && next !== status.name) void saveStatus(status, { name: next })
              }}
            />
            <div className="top-actions">
              <input
                type="color"
                value={status.color}
                aria-label="Цвет"
                disabled={pending}
                onChange={(event) => void saveStatus(status, { color: event.target.value })}
              />
              <Select
                variant="toolbar"
                value={status.category}
                aria-label="Категория"
                disabled={pending}
                options={(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => ({
                  value: key,
                  label: STATUS_LABEL[key],
                }))}
                onChange={(category) => void saveStatus(status, { category })}
              />
              <button type="button" className="ghost" disabled={pending} onClick={() => void removeStatus(status)}>
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
      <form className="top-actions" onSubmit={(event) => void createStatus(event)} style={{ marginTop: 12 }}>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Новая колонка"
          required
          disabled={pending}
        />
        <input type="color" value={color} onChange={(event) => setColor(event.target.value)} disabled={pending} />
        <Select
          variant="toolbar"
          value={category}
          aria-label="Категория колонки"
          disabled={pending}
          options={(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => ({
            value: key,
            label: STATUS_LABEL[key],
          }))}
          onChange={setCategory}
        />
        <button type="submit" className="pill" disabled={pending}>
          Добавить
        </button>
      </form>
    </div>
  )
}
