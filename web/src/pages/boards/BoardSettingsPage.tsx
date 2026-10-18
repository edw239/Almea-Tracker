import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../../components/PageHeader'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { api } from '../../lib/api'
import type { BoardDetail } from '../../lib/board-types'
import { useStore } from '../../store'
import type { TaskList } from '../../types'

const CARD_FIELD_OPTIONS = [
  { id: 'epic', label: 'Эпик' },
  { id: 'labels', label: 'Метки' },
  { id: 'points', label: 'Оценка' },
  { id: 'due', label: 'Срок' },
  { id: 'brand', label: 'Бренд' },
  { id: 'priority', label: 'Приоритет' },
] as const

const FILTER_FIELDS = [
  { field: 'title', operator: 'contains', label: 'Название содержит' },
  { field: 'priority', operator: 'is', label: 'Приоритет' },
  { field: 'assignee_id', operator: 'is', label: 'Исполнитель' },
  { field: 'key', operator: 'is', label: 'Ключ' },
  { field: 'epic_id', operator: 'is', label: 'Эпик' },
] as const

type ColumnDraft = { name: string; statusNames: string[]; minWip: string; maxWip: string }
type QueryLane = { key: string; titleContains: string }

function normalizeStatusName(name: string): string {
  return name.trim().toLocaleLowerCase('ru-RU')
}

function sourceListIds(board: BoardDetail, lists: TaskList[]): string[] {
  const ids = new Set<string>()
  for (const source of board.sources) {
    if (source.listId) ids.add(source.listId)
    if (source.spaceId) {
      for (const list of lists) if (list.spaceId === source.spaceId) ids.add(list.id)
    }
    if (source.folderId) {
      for (const list of lists) if (list.folderId === source.folderId) ids.add(list.id)
    }
  }
  return [...ids]
}

export function BoardSettingsPage() {
  const { boardId = '' } = useParams()
  const store = useStore()
  const [board, setBoard] = useState<BoardDetail | null>(null)
  const [columns, setColumns] = useState<ColumnDraft[]>([])
  const [pool, setPool] = useState<string[]>([])
  const [filterName, setFilterName] = useState('Мой фильтр')
  const [filterField, setFilterField] = useState<(typeof FILTER_FIELDS)[number]['field']>('title')
  const [filterValue, setFilterValue] = useState('')
  const [cardColor, setCardColor] = useState('NONE')
  const [fields, setFields] = useState<string[]>(['epic', 'labels', 'points'])
  const [swimlaneBy, setSwimlaneBy] = useState('NONE')
  const [queryLanes, setQueryLanes] = useState<QueryLane[]>([])
  const [laneName, setLaneName] = useState('')
  const [laneContains, setLaneContains] = useState('')
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  useEffect(() => {
    void api.board(boardId).then(async (row) => {
      setBoard(row)
      setCardColor(row.cardColorBy ?? 'NONE')
      setSwimlaneBy(row.swimlaneBy ?? 'NONE')
      const current = Array.isArray(row.cardFields)
        ? row.cardFields.filter((item): item is string => typeof item === 'string').slice(0, 3)
        : ['epic', 'labels', 'points']
      setFields(current)
      const drafts = (row.columns ?? []).map((column) => ({
        name: column.name,
        statusNames: [...column.statusNames],
        minWip: column.minWip == null ? '' : String(column.minWip),
        maxWip: column.maxWip == null ? '' : String(column.maxWip),
      }))
      setColumns(drafts)
      const queries = Array.isArray(row.swimlaneQueries) ? row.swimlaneQueries : []
      setQueryLanes(
        queries.flatMap((query) => {
          if (!query || typeof query !== 'object' || !('key' in query)) return []
          const key = String((query as { key?: unknown }).key ?? '')
          const titleContains = String((query as { titleContains?: unknown }).titleContains ?? '')
          return key ? [{ key, titleContains }] : []
        }),
      )
      const assigned = new Set(drafts.flatMap((column) => column.statusNames))
      const names = new Set<string>()
      const lists = sourceListIds(row, store.lists)
      const statusGroups = await Promise.all(lists.map((listId) => api.listStatuses(listId)))
      for (const group of statusGroups) {
        for (const status of group as Array<{ name: string; category: string; isBacklog?: boolean }>) {
          if (status.category === 'CANCELLED' || status.isBacklog) continue
          names.add(normalizeStatusName(status.name))
        }
      }
      setPool([...names].filter((name) => !assigned.has(name)))
    })
  }, [boardId, store.lists])

  function moveStatus(name: string, target: 'pool' | number) {
    setColumns((rows) => {
      const next = rows.map((row) => ({ ...row, statusNames: row.statusNames.filter((item) => item !== name) }))
      if (typeof target === 'number' && next[target]) {
        next[target] = { ...next[target], statusNames: [...next[target].statusNames, name] }
      }
      return next
    })
    setPool((current) => {
      const without = current.filter((item) => item !== name)
      return target === 'pool' ? [...without, name] : without
    })
  }

  function onDragEnd(event: DragEndEvent) {
    const over = event.over?.id
    if (over == null) return
    const name = decodeURIComponent(String(event.active.id).replace(/^status:/, ''))
    const target = String(over)
    if (target === 'pool') moveStatus(name, 'pool')
    if (target.startsWith('col:')) moveStatus(name, Number(target.slice(4)))
  }

  async function saveColumns(event: FormEvent) {
    event.preventDefault()
    await api.replaceBoardColumns(
      boardId,
      columns.map((column) => ({
        name: column.name,
        statusNames: column.statusNames,
        minWip: column.minWip ? Number(column.minWip) : null,
        maxWip: column.maxWip ? Number(column.maxWip) : null,
      })),
    )
  }

  const fieldMeta = FILTER_FIELDS.find((item) => item.field === filterField) ?? FILTER_FIELDS[0]

  return (
    <div className="space-y-6">
      <PageHeader
        overline="Доска"
        title="Настройки"
        subtitle={board?.name}
        toolbar={
          <Button variant="ghost" size="compact" asChild>
            <Link to={`/boards/${boardId}`}>К доске</Link>
          </Button>
        }
      />
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <form className="space-y-3" onSubmit={(event) => void saveColumns(event)}>
          <h2 className="text-lg font-medium">Колонки</h2>
          <p className="text-sm text-muted-foreground">Перетащите статус в колонку. То, что осталось в «Не на доске», скрывает свои задачи.</p>
          <StatusPool names={pool} />
          {columns.map((column, index) => (
            <ColumnEditor
              key={index}
              index={index}
              column={column}
              onChange={(next) => setColumns((rows) => rows.map((row, rowIndex) => (rowIndex === index ? next : row)))}
            />
          ))}
          <Button type="button" variant="ghost" onClick={() => setColumns((rows) => [...rows, { name: 'Новая', statusNames: [], minWip: '', maxWip: '' }])}>
            Добавить колонку
          </Button>
          <Button type="submit">Сохранить колонки</Button>
        </form>
      </DndContext>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (!filterValue.trim()) return
          void api.addQuickFilter(boardId, {
            name: filterName,
            filter: { op: 'AND', children: [{ field: fieldMeta.field, operator: fieldMeta.operator, value: filterValue.trim() }] },
          }).then(() => api.board(boardId).then(setBoard))
        }}
      >
        <h2 className="text-lg font-medium">Быстрые фильтры</h2>
        <Input value={filterName} onChange={(event) => setFilterName(event.target.value)} aria-label="Имя фильтра" />
        <div className="flex flex-wrap gap-2">
          <select aria-label="Поле" className="h-10 rounded bg-inset px-2" value={filterField} onChange={(event) => setFilterField(event.target.value as typeof filterField)}>
            {FILTER_FIELDS.map((item) => (
              <option key={item.field} value={item.field}>{item.label}</option>
            ))}
          </select>
          {filterField === 'priority' ? (
            <select aria-label="Значение" className="h-10 rounded bg-inset px-2" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Приоритет</option>
              <option value="URGENT">Срочный</option>
              <option value="HIGH">Высокий</option>
              <option value="MEDIUM">Средний</option>
              <option value="LOW">Низкий</option>
            </select>
          ) : filterField === 'assignee_id' ? (
            <select aria-label="Значение" className="h-10 rounded bg-inset px-2" value={filterValue} onChange={(event) => setFilterValue(event.target.value)}>
              <option value="">Исполнитель</option>
              {store.users.map((user) => (
                <option key={user.id} value={user.id}>{user.name}</option>
              ))}
            </select>
          ) : (
            <Input value={filterValue} onChange={(event) => setFilterValue(event.target.value)} placeholder="Значение" aria-label="Значение" />
          )}
        </div>
        <Button type="submit">Добавить фильтр</Button>
        <ul className="text-sm">
          {(board?.quickFilters ?? []).map((filter) => (
            <li key={filter.id} className="flex items-center gap-2">
              {filter.name}
              <button type="button" className="text-destructive" onClick={() => void api.removeQuickFilter(boardId, filter.id).then(() => api.board(boardId).then(setBoard))}>
                Удалить
              </button>
            </li>
          ))}
        </ul>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void api.updateBoard(boardId, {
            swimlaneBy,
            swimlaneQueries: queryLanes,
          })
        }}
      >
        <h2 className="text-lg font-medium">Дорожки</h2>
        <select aria-label="Дорожки" className="h-10 rounded bg-inset px-2" value={swimlaneBy} onChange={(event) => setSwimlaneBy(event.target.value)}>
          <option value="NONE">Без дорожек</option>
          <option value="ASSIGNEE">Исполнитель</option>
          <option value="EPIC">Эпик</option>
          <option value="BRAND">Бренд</option>
          <option value="PRIORITY">Приоритет</option>
          <option value="QUERIES">Запросы</option>
        </select>
        <div className="flex flex-wrap gap-2">
          <Input aria-label="Имя дорожки" placeholder="Имя дорожки" value={laneName} onChange={(event) => setLaneName(event.target.value)} />
          <Input aria-label="Название содержит" placeholder="Название содержит" value={laneContains} onChange={(event) => setLaneContains(event.target.value)} />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              if (!laneName.trim() || !laneContains.trim()) return
              setQueryLanes((rows) => [...rows, { key: laneName.trim(), titleContains: laneContains.trim() }])
              setLaneName('')
              setLaneContains('')
            }}
          >
            Добавить запрос
          </Button>
        </div>
        <ul className="text-sm">
          {queryLanes.map((lane) => (
            <li key={lane.key}>
              {lane.key}: {lane.titleContains}
            </li>
          ))}
        </ul>
        <Button type="submit">Сохранить дорожки</Button>
      </form>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault()
          void api.updateBoard(boardId, { cardColorBy: cardColor, cardFields: fields })
        }}
      >
        <h2 className="text-lg font-medium">Карточка</h2>
        <select aria-label="Цвет" value={cardColor} onChange={(event) => setCardColor(event.target.value)} className="h-10 rounded bg-inset px-2">
          <option value="NONE">Без цвета</option>
          <option value="PRIORITY">Приоритет</option>
          <option value="TYPE">Тип</option>
          <option value="ASSIGNEE">Исполнитель</option>
        </select>
        <div className="flex flex-wrap gap-3 text-sm">
          {CARD_FIELD_OPTIONS.map((option) => (
            <label key={option.id} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={fields.includes(option.id)}
                onChange={() =>
                  setFields((current) =>
                    current.includes(option.id)
                      ? current.filter((item) => item !== option.id)
                      : current.length >= 3
                        ? current
                        : [...current, option.id],
                  )
                }
              />
              {option.label}
            </label>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">До трёх дополнительных полей.</p>
        <Button type="submit">Сохранить карточку</Button>
      </form>
    </div>
  )
}

function StatusPool({ names }: { names: string[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' })
  return (
    <div ref={setNodeRef} className={`min-h-12 rounded bg-inset p-2 ${isOver ? 'ring-2 ring-primary/40' : ''}`}>
      <p className="mb-2 text-xs text-muted-foreground">Не на доске</p>
      <div className="flex flex-wrap gap-2">
        {names.map((name) => (
          <StatusChip key={name} name={name} />
        ))}
      </div>
    </div>
  )
}

function ColumnEditor({
  index,
  column,
  onChange,
}: {
  index: number
  column: ColumnDraft
  onChange: (next: ColumnDraft) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${index}` })
  return (
    <div ref={setNodeRef} className={`space-y-2 rounded bg-surface p-3 ${isOver ? 'ring-2 ring-primary/40' : ''}`}>
      <div className="grid gap-2 md:grid-cols-3">
        <Input aria-label="Колонка" value={column.name} onChange={(event) => onChange({ ...column, name: event.target.value })} />
        <Input aria-label="Мин. WIP" placeholder="мин" value={column.minWip} onChange={(event) => onChange({ ...column, minWip: event.target.value })} />
        <Input aria-label="Макс. WIP" placeholder="макс" value={column.maxWip} onChange={(event) => onChange({ ...column, maxWip: event.target.value })} />
      </div>
      <div className="flex flex-wrap gap-2">
        {column.statusNames.map((name) => (
          <StatusChip key={name} name={name} />
        ))}
      </div>
    </div>
  )
}

function StatusChip({ name }: { name: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `status:${encodeURIComponent(name)}` })
  return (
    <span
      ref={setNodeRef}
      className={`cursor-grab rounded bg-elevated px-2 py-1 text-xs ${isDragging ? 'opacity-60' : ''}`}
      {...listeners}
      {...attributes}
    >
      {name}
    </span>
  )
}
