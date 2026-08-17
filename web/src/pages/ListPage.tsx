import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BoardView } from '../components/BoardView'
import { TaskPanel } from '../components/TaskPanel'
import { Avatars, QuickAdd, StatusChip, TaskRow } from '../components/ui'
import { ApiError, api } from '../lib/api'
import {
  buildListFilters,
  EMPTY_FILTER,
  filtersToQuery,
  hasActiveFilters,
  parseFiltersToDraft,
  type FilterDraft,
} from '../lib/filters'
import { byPosition, formatDay, isoDate, monthGrid, startOfDay, PRIORITY_LABEL, STATUS_LABEL } from '../lib/format'
import { groupTasks, type GroupBy } from '../lib/mechanics'
import { boardColumns, resolveStatusesForList } from '../lib/status'
import { useStore } from '../store'
import type { Task, TaskPriority, TaskStatus, ViewType } from '../types'

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

export function ListPage() {
  const { listId } = useParams()
  const [params, setParams] = useSearchParams()
  const store = useStore()
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
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const reportError = useCallback((error: unknown, fallback: string) => {
    setActionError(error instanceof ApiError ? error.message : fallback)
  }, [])

  const reloadExtras = useCallback(async (id: string) => {
    const [views, tpls] = await Promise.all([
      api.listViews(id).catch(() => []),
      api.listTemplates(id).catch(() => []),
    ])
    setSavedViews(views)
    setTemplates(tpls.map((item) => ({ id: item.id, name: item.name })))
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
    const name = window.prompt('Название вида')
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
  }, [appliedFilters, groupBy, listId, reloadExtras, reportError, view])

  const deleteActiveView = useCallback(async () => {
    if (!listId || !activeViewId) return
    if (!window.confirm('Удалить сохранённый вид?')) return
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
  }, [activeViewId, listId, reloadExtras, reportError])

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
    return <p className="content">{store.ready ? 'Список не найден' : 'Загрузка…'}</p>
  }

  const selected = store.tasks.find((task) => task.id === selectedId)
  const starred = store.favorites.some((item) => item.entityType === 'TASK_LIST' && item.entityId === list.id)
  const personal = list.systemKey === 'personal-inbox'
  const empty = tasks.length === 0

  return (
    <div className={selected ? 'with-panel' : undefined}>
      <div>
        <header className="topbar">
          <div>
            <div className="kicker">List</div>
            <h1 className="page-title">{list.name}</h1>
            <p className="page-lead">
              {personal
                ? 'Личный захват. Пока вы исполнитель — задача видна в Моей работе.'
                : 'Единица работы. Создайте задачу, откройте карточку или перетащите на доске.'}
            </p>
            {store.error || actionError ? <p className="form-error">{store.error ?? actionError}</p> : null}
          </div>
          <div className="top-actions">
            <div className="seg">
              {VIEWS.map((item) => {
                const next = new URLSearchParams(params)
                next.set('view', item.id)
                return (
                  <Link key={item.id} to={`/lists/${list.id}?${next}`} className={view === item.id ? 'active' : ''}>
                    {item.label}
                  </Link>
                )
              })}
            </div>
            <select
              value={groupBy}
              onChange={(event) => {
                const next = event.target.value as GroupBy
                setGroupBy(next)
                void api.putViewPreference({ listId: list.id, groupBy: next, viewType: view })
              }}
              aria-label="Группировка"
            >
              {GROUP_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Сохранённые виды"
              value={activeViewId}
              disabled={busy}
              onChange={(event) => {
                const id = event.target.value
                if (!id) {
                  setActiveViewId('')
                  return
                }
                const saved = savedViews.find((item) => item.id === id)
                if (saved) applySavedView(saved)
              }}
            >
              <option value="">Виды…</option>
              {savedViews.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.isShared ? ' · shared' : ''}
                </option>
              ))}
            </select>
            <button type="button" className="ghost" disabled={busy} onClick={() => void saveCurrentView()}>
              Сохранить вид
            </button>
            {activeViewId ? (
              <button type="button" className="ghost" disabled={busy} onClick={() => void deleteActiveView()}>
                Удалить вид
              </button>
            ) : null}
            <button type="button" className="ghost" onClick={() => void store.toggleFavorite('TASK_LIST', list.id)}>
              {starred ? 'В избранном' : 'В избранное'}
            </button>
          </div>
        </header>
        <div className="content">
          <form
            className="filter-bar"
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
            <select
              aria-label="Статус"
              value={filterDraft.status}
              onChange={(event) =>
                setFilterDraft((prev) => ({ ...prev, status: event.target.value as TaskStatus | '' }))
              }
            >
              <option value="">Статус</option>
              {(Object.keys(STATUS_LABEL) as TaskStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABEL[key]}
                </option>
              ))}
            </select>
            <select
              aria-label="Приоритет"
              value={filterDraft.priority}
              onChange={(event) =>
                setFilterDraft((prev) => ({ ...prev, priority: event.target.value as TaskPriority | '' }))
              }
            >
              <option value="">Приоритет</option>
              {(Object.keys(PRIORITY_LABEL) as TaskPriority[]).map((key) => (
                <option key={key} value={key}>
                  {PRIORITY_LABEL[key]}
                </option>
              ))}
            </select>
            <select
              aria-label="Исполнитель"
              value={filterDraft.assigneeId}
              onChange={(event) => setFilterDraft((prev) => ({ ...prev, assigneeId: event.target.value }))}
            >
              <option value="">Исполнитель</option>
              {store.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <input
              aria-label="Название"
              placeholder="Название содержит…"
              value={filterDraft.title}
              onChange={(event) => setFilterDraft((prev) => ({ ...prev, title: event.target.value }))}
            />
            <button className="pill" type="submit">
              Фильтр
            </button>
            {hasActiveFilters(filterDraft) || appliedFilters ? (
              <button
                type="button"
                className="ghost"
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
              </button>
            ) : null}
          </form>

          <div className="template-bar">
            <select
              aria-label="Шаблон"
              defaultValue=""
              disabled={busy || templates.length === 0}
              onChange={(event) => {
                const templateId = event.target.value
                event.target.value = ''
                if (templateId) void createFromTemplate(templateId)
              }}
            >
              <option value="">{templates.length ? 'Создать из шаблона…' : 'Нет шаблонов'}</option>
              {templates.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

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
            <div className="empty">
              {appliedFilters
                ? 'Нет задач по фильтру. Сбросьте фильтр или измените условия.'
                : 'В списке пока пусто. Добавьте задачу или разверните шаблон.'}
            </div>
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
  const days = useMemo(() => monthGrid(new Date()), [])
  const today = isoDate(startOfDay(new Date()))
  const tasks = store.tasks.filter((task) => task.listId === listId && task.dueDate)
  const heads = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс']
  const month = new Date().getMonth()

  return (
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
  )
}
