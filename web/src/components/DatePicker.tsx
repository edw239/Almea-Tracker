import type { ReactElement } from 'react'
import { useMemo, useState } from 'react'
import { buildDateValue, formatDateDisplay, parseDateValue } from '../lib/datetime-local'
import { Calendar as CalendarIcon } from '../lib/icons'
import { cn } from '../lib/utils'
import { Button } from './ui/button'
import { Calendar } from './ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'

export interface DatePickerProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
  disabled?: boolean
  clearable?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'дд.мм.гггг',
  className,
  id,
  disabled = false,
  clearable = true,
}: DatePickerProps): ReactElement {
  const parsedDate = useMemo(() => parseDateValue(value), [value])
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => parsedDate ?? new Date())

  const displayLabel = value ? formatDateDisplay(value) : placeholder

  return (
    <Popover modal={false} open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          className={cn(
            'input-field flex w-full min-w-0 items-center gap-2.5 overflow-hidden px-3 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50',
            !value && 'text-subtle-foreground',
            className,
          )}
        >
          <CalendarIcon size={16} strokeWidth={1.5} className="shrink-0 text-subtle-foreground" />
          <span className="truncate">{displayLabel}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-3" align="start">
        <Calendar
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={parsedDate ?? undefined}
          onSelect={(day) => {
            if (!day) return
            onChange(buildDateValue(day))
            setOpen(false)
          }}
          density="compact"
        />
        <div className="mt-2 flex justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="compact"
            onClick={() => {
              const today = new Date()
              const day = new Date(today.getFullYear(), today.getMonth(), today.getDate())
              setMonth(day)
              onChange(buildDateValue(day))
              setOpen(false)
            }}
          >
            Сегодня
          </Button>
          {clearable ? (
            <Button
              type="button"
              variant="ghost"
              size="compact"
              onClick={() => {
                onChange('')
                setOpen(false)
              }}
            >
              Очистить
            </Button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
