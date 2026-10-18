import {
  DndContext,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { ListStatus, Task } from '../types'
import { useAxisLockedHorizontalScroll } from '../hooks/useAxisLockedHorizontalScroll'
import { dueLabel, isOverdue } from '../lib/format'
import { columnDropId, parseColumnDropId } from '../lib/mechanics'
import { cn } from '../lib/utils'
import { useStore } from '../store'
import { IssueCardFace } from './board/IssueCard'

const collisionDetection: CollisionDetection = (args) => {
  const pointer = pointerWithin(args)
  return pointer.length > 0 ? pointer : rectIntersection(args)
}

export function BoardView({
  columns,
  tasks,
  selectedId,
  onOpen,
}: {
  columns: ListStatus[]
  tasks: Task[]
  selectedId: string | null
  onOpen: (id: string) => void
}) {
  const store = useStore()
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))
  const scrollerRef = useAxisLockedHorizontalScroll<HTMLDivElement>()

  const onDragEnd = (event: DragEndEvent) => {
    const overId = event.over?.id
    if (overId == null) return
    const listStatusId = parseColumnDropId(String(overId))
    if (!listStatusId) return
    const taskId = String(event.active.id)
    const task = tasks.find((item) => item.id === taskId)
    if (!task || task.listStatusId === listStatusId) return
    void store.setStatus(taskId, listStatusId)
  }

  return (
    <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragEnd={onDragEnd}>
      <div ref={scrollerRef} className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((column) => (
          <BoardColumn
            key={column.id}
            column={column}
            tasks={tasks.filter((task) => task.listStatusId === column.id)}
            selectedId={selectedId}
            onOpen={onOpen}
          />
        ))}
      </div>
    </DndContext>
  )
}

function BoardColumn({
  column,
  tasks,
  selectedId,
  onOpen,
}: {
  column: ListStatus
  tasks: Task[]
  selectedId: string | null
  onOpen: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(column.id) })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded bg-surface p-2',
        isOver && 'ring-2 ring-primary/30',
      )}
    >
      <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {column.name} · {tasks.length}
      </h3>
      {tasks.map((task) => (
        <BoardCard key={task.id} task={task} active={task.id === selectedId} onOpen={onOpen} />
      ))}
    </div>
  )
}

function BoardCard({
  task,
  active,
  onOpen,
}: {
  task: Task
  active: boolean
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id })
  const due = dueLabel(task)
  const overdue = isOverdue(task)
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={cn(
        'w-full rounded bg-elevated p-3 text-left transition-shadow',
        active && 'accent-marker ring-1 ring-border',
        isDragging && 'opacity-60 shadow-lg',
      )}
      onClick={() => onOpen(task.id)}
      {...listeners}
      {...attributes}
    >
      <IssueCardFace
        face={{
          key: task.key,
          title: task.title,
          priority: task.priority,
          domainLabel: task.domainLabel,
          storyPoints: task.storyPoints,
          labels: task.labels,
          isStuck: task.isStuck,
          subtaskLabel: (task.subtaskCount ?? 0) > 0 ? String(task.subtaskCount) : null,
          assigneeIds: task.assigneeIds,
          dueText: due,
          dueTone: overdue ? 'overdue' : due === 'сегодня' ? 'today' : null,
        }}
      />
    </button>
  )
}
