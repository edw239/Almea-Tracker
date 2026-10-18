import { format, isValid, parse } from 'date-fns'
import { ru } from 'date-fns/locale'

const DATE_PATTERN = 'yyyy-MM-dd'
const DISPLAY_PATTERN = 'd MMM yyyy'

export function parseDateValue(value: string): Date | null {
  if (!value.trim()) return null
  const parsed = parse(value, DATE_PATTERN, new Date())
  return isValid(parsed) ? parsed : null
}

export function buildDateValue(day: Date): string {
  return format(day, DATE_PATTERN)
}

export function formatDateDisplay(value: string): string {
  const parsed = parseDateValue(value)
  if (!parsed) return value
  return format(parsed, DISPLAY_PATTERN, { locale: ru })
}
