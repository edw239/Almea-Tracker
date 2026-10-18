import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Flag } from '../../lib/icons'
import { cn } from '../../lib/utils'
import type { BoardCard } from '../../lib/board-types'
import { Avatars } from '../ui'

const PRIORITY_MARK: Record<string, string> = {
  URGENT: 'bg-destructive',
  HIGH: 'bg-[var(--warning)]',
  MEDIUM: 'bg-primary',
  LOW: 'bg-muted-foreground',
}

const DEFAULT_EXTRA_FIELDS = ['epic', 'labels', 'points']

export type IssueFace = {
  key?: string | null
  title: string
  priority: string
  taskTypeName?: string | null
  taskTypeColor?: string | null
  epicKey?: string | null
  epicTitle?: string | null
  epicColor?: string | null
  domainLabel?: string | null
  storyPoints?: number | null
  labels?: Array<{ id: string; name: string }>
  isStuck?: boolean
  subtaskLabel?: string | null
  daysInColumn?: number | null
  assigneeIds: string[]
  dueText?: string | null
  dueTone?: 'overdue' | 'today' | null
}

export function IssueCardFace({
  face,
  colorBy = 'NONE',
  extraFields = DEFAULT_EXTRA_FIELDS,
}: {
  face: IssueFace
  colorBy?: string
  extraFields?: string[]
}) {
  const extras = new Set(extraFields)
  const tint =
    colorBy === 'PRIORITY'
      ? PRIORITY_MARK[face.priority]
      : colorBy === 'ASSIGNEE'
        ? 'bg-primary'
        : undefined
  return (
    <>
      <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {tint ? <span className={cn('h-2 w-2 rounded-full', tint)} /> : null}
        {face.taskTypeColor ? (
          <span className="h-2 w-2 rounded-full" style={{ background: face.taskTypeColor }} />
        ) : null}
        <span>{face.taskTypeName ?? 'Задача'}</span>
        <span className="ml-auto font-medium text-foreground">{face.key}</span>
      </div>
      <strong className="block text-sm font-medium text-foreground">{face.title}</strong>
      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {extras.has('epic') && face.epicTitle ? (
          <span
            className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground"
            style={face.epicColor ? { background: face.epicColor } : undefined}
          >
            {face.epicKey}
          </span>
        ) : null}
        {face.domainLabel ? <span className="rounded bg-inset px-1.5 py-0.5">{face.domainLabel}</span> : null}
        {extras.has('points') && face.storyPoints != null ? (
          <span className="rounded bg-inset px-1.5 py-0.5">{face.storyPoints}</span>
        ) : null}
        {extras.has('labels')
          ? face.labels?.map((label) => (
              <span key={label.id} className="rounded bg-inset px-1.5 py-0.5">
                {label.name}
              </span>
            ))
          : null}
        {face.dueText ? (
          <span
            className={cn(
              'rounded bg-inset px-1.5 py-0.5',
              face.dueTone === 'overdue' && 'bg-[var(--danger-soft)] text-destructive',
              face.dueTone === 'today' && 'bg-accent text-accent-foreground',
            )}
          >
            {face.dueText}
          </span>
        ) : null}
        {face.isStuck ? <Flag size={14} className="text-[var(--warning)]" /> : null}
        {face.subtaskLabel ? <span>{face.subtaskLabel}</span> : null}
        {face.daysInColumn != null ? <span className="ml-auto">{face.daysInColumn} дн.</span> : null}
        <Avatars ids={face.assigneeIds.slice(0, 1)} />
        {face.assigneeIds.length > 1 ? <span>+{face.assigneeIds.length - 1}</span> : null}
      </p>
    </>
  )
}

export function IssueCard({
  card,
  selected,
  colorBy,
  extraFields,
  onOpen,
}: {
  card: BoardCard
  selected: boolean
  colorBy: string
  extraFields?: string[]
  onOpen: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    disabled: !card.canMove,
    data: { columnId: card.columnId, laneKey: card.laneKey },
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      style={style}
      className={cn(
        'w-full rounded bg-elevated p-3 text-left shadow-sm',
        selected && 'ring-1 ring-border',
        isDragging && 'opacity-60',
        card.isStuck && 'bg-amber-50',
      )}
      onClick={() => onOpen(card.id)}
      {...listeners}
      {...attributes}
    >
      <IssueCardFace
        face={{
          key: card.key,
          title: card.title,
          priority: card.priority,
          taskTypeName: card.taskTypeName,
          taskTypeColor: card.taskTypeColor,
          epicKey: card.epicKey,
          epicTitle: card.epicTitle,
          epicColor: card.epicColor,
          domainLabel: card.domainLabel,
          storyPoints: card.storyPoints,
          labels: card.labels,
          isStuck: card.isStuck,
          subtaskLabel: card.subtaskTotal > 0 ? `${card.subtaskDone}/${card.subtaskTotal}` : null,
          daysInColumn: card.daysInColumn,
          assigneeIds: card.assigneeIds,
          dueText: card.dueDate ? card.dueDate.slice(0, 10) : null,
        }}
        colorBy={colorBy}
        extraFields={extraFields}
      />
    </button>
  )
}
