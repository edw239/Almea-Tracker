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
import { dueLabel, isOverdue } from '../lib/format'
import { columnDropId, parseColumnDropId } from '../lib/mechanics'
import { useStore } from '../store'
import { Avatars } from './ui'

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
      <div className="board">
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
    <div ref={setNodeRef} className={`column ${isOver ? 'is-over' : ''}`}>
      <h3>
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
      className={`kanban-card ${active ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onOpen(task.id)}
      {...listeners}
      {...attributes}
    >
      <strong>{task.title}</strong>
      <p className="kanban-meta">
        {task.domainLabel ? <span>{task.domainLabel}</span> : null}
        {due ? <span className={overdue ? 'warn' : due === 'сегодня' ? 'today' : ''}>{due}</span> : null}
        <Avatars ids={task.assigneeIds} />
      </p>
    </button>
  )
}
