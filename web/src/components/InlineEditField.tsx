import type { ReactElement } from 'react'
import { useEffect, useState } from 'react'
import { Check, Pencil, X } from '../lib/icons'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

interface InlineEditFieldProps {
  label: string
  value: string
  canEdit: boolean
  saving?: boolean
  emptyLabel?: string
  className?: string
  onSave: (value: string) => Promise<void> | void
}

export function InlineEditField({
  label,
  value,
  canEdit,
  saving = false,
  emptyLabel = '—',
  className,
  onSave,
}: InlineEditFieldProps): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  if (!editing) {
    return (
      <div className={cn('group flex items-start justify-between gap-2', className)}>
        <div className="min-w-0">
          <p className="label-overline mb-1">{label}</p>
          <p className="text-sm text-foreground">{value.trim() ? value : emptyLabel}</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-subtle-foreground opacity-0 transition-opacity hover:bg-inset hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Редактировать: ${label}`}
            onClick={() => setEditing(true)}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <p className="label-overline">{label}</p>
      <input
        className="input-field px-3 py-2 text-sm"
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            setEditing(false)
          }
          if (e.key === 'Enter') {
            e.preventDefault()
            void Promise.resolve(onSave(draft.trim())).then(() => setEditing(false))
          }
        }}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="compact"
          disabled={saving || !draft.trim()}
          onClick={() => {
            void Promise.resolve(onSave(draft.trim())).then(() => setEditing(false))
          }}
        >
          <Check size={14} />
          Сохранить
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="compact"
          disabled={saving}
          onClick={() => setEditing(false)}
        >
          <X size={14} />
          Отмена
        </Button>
      </div>
    </div>
  )
}
