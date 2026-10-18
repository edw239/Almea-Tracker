import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useState } from 'react'
import type { BoardCard, BoardColumnInput } from '../../lib/board-types'
import { cn } from '../../lib/utils'
import { IssueCard } from './IssueCard'

export function BoardCanvas({
  columns,
  lanes,
  cards,
  colorBy,
  extraFields,
  selectedId,
  onOpen,
  onMove,
  onCreate,
}: {
  columns: BoardColumnInput[]
  lanes: Array<{ key: string; label: string }>
  cards: BoardCard[]
  colorBy: string
  extraFields?: string[]
  selectedId: string | null
  onOpen: (id: string) => void
  onMove: (taskId: string, columnId: string, laneKey: string, beforeId: string | null, afterId: string | null) => void
  onCreate?: () => void
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const dragging = cards.find((card) => card.id === draggingId)
  const visibleLanes = lanes.length > 0 ? lanes : [{ key: 'all', label: '' }]

  const onDragStart = (event: DragStartEvent) => setDraggingId(String(event.active.id))
  const onDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    const taskId = String(event.active.id)
    const overId = event.over?.id
    if (overId == null) return
    const over = String(overId)
    const card = cards.find((item) => item.id === taskId)
    if (!card) return
    if (over.startsWith('col:')) {
      const [, columnId, laneKey] = over.split(':')
      if (!columnId || !card.availableColumnIds.includes(columnId)) return
      const inCell = cards.filter((item) => item.columnId === columnId && item.laneKey === (laneKey ?? card.laneKey) && item.id !== taskId)
      const last = inCell.at(-1)
      onMove(taskId, columnId, laneKey ?? card.laneKey, last?.id ?? null, null)
      return
    }
    const target = cards.find((item) => item.id === over)
    if (!target || !card.availableColumnIds.includes(target.columnId)) return
    const inCell = cards.filter((item) => item.columnId === target.columnId && item.laneKey === target.laneKey && item.id !== taskId)
    const index = inCell.findIndex((item) => item.id === target.id)
    const before = index > 0 ? inCell[index - 1] : undefined
    onMove(taskId, target.columnId, target.laneKey, before?.id ?? null, target.id)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="space-y-4">
        {visibleLanes.map((lane) => (
          <section key={lane.key} className="space-y-2">
            {lane.label ? <h3 className="px-1 text-sm font-medium">{lane.label}</h3> : null}
            <div className="flex gap-3 overflow-x-auto pb-2">
              {columns.map((column, columnIndex) => {
                const cell = cards.filter((card) => card.columnId === column.id && (lane.key === 'all' || card.laneKey === lane.key))
                const blocked = Boolean(dragging && !dragging.availableColumnIds.includes(column.id ?? ''))
                const overWip = column.maxWip != null && cell.length > column.maxWip
                return (
                  <Column
                    key={`${lane.key}-${column.id}`}
                    column={column}
                    laneKey={lane.key}
                    cards={cell}
                    blocked={blocked}
                    overWip={overWip}
                    colorBy={colorBy}
                    extraFields={extraFields}
                    selectedId={selectedId}
                    onOpen={onOpen}
                    onCreate={columnIndex === 0 && lane.key === visibleLanes[0]?.key ? onCreate : undefined}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </DndContext>
  )
}

function Column({
  column,
  laneKey,
  cards,
  blocked,
  overWip,
  colorBy,
  extraFields,
  selectedId,
  onOpen,
  onCreate,
}: {
  column: BoardColumnInput
  laneKey: string
  cards: BoardCard[]
  blocked: boolean
  overWip: boolean
  colorBy: string
  extraFields?: string[]
  selectedId: string | null
  onOpen: (id: string) => void
  onCreate?: () => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${column.id}:${laneKey}`, disabled: blocked })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded bg-surface p-2',
        isOver && !blocked && 'ring-2 ring-primary/30',
        blocked && 'opacity-40',
      )}
    >
      <h3 className={cn('px-1 text-xs font-medium uppercase tracking-wide', overWip ? 'text-destructive' : 'text-muted-foreground')}>
        {column.name} · {column.maxWip != null ? `${cards.length}/${column.maxWip}` : cards.length}
      </h3>
      <SortableContext items={cards.map((card) => card.id)} strategy={verticalListSortingStrategy}>
        {cards.map((card) => (
          <IssueCard
            key={card.id}
            card={card}
            selected={card.id === selectedId}
            colorBy={colorBy}
            extraFields={extraFields}
            onOpen={onOpen}
          />
        ))}
      </SortableContext>
      {onCreate ? (
        <button type="button" className="rounded px-2 py-1 text-left text-xs text-muted-foreground hover:bg-inset" onClick={onCreate}>
          + Создать
        </button>
      ) : null}
    </div>
  )
}
