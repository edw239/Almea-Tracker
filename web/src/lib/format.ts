import type { Task, TaskPriority, TaskStatus } from '../types'

const DAY = 24 * 60 * 60 * 1000

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function formatDay(value: string): string {
  return parseDate(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  })
}

export function formatDayFull(value: string): string {
  return parseDate(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  })
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isOverdue(task: Task, now = new Date()): boolean {
  if (!task.dueDate) return false
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false
  return parseDate(task.dueDate) < startOfDay(now)
}

export function isDueSoon(task: Task, now = new Date()): boolean {
  if (!task.dueDate) return false
  if (task.status === 'DONE' || task.status === 'CANCELLED') return false
  const due = parseDate(task.dueDate).getTime()
  const today = startOfDay(now).getTime()
  return due >= today && due <= today + DAY
}

export function dueLabel(task: Task, now = new Date()): string | null {
  if (!task.dueDate) return null
  const due = startOfDay(parseDate(task.dueDate)).getTime()
  const today = startOfDay(now).getTime()
  const diff = Math.round((due - today) / DAY)
  if (diff === 0) return 'сегодня'
  if (diff === 1) return 'завтра'
  if (diff === -1) return 'вчера'
  return formatDay(task.dueDate)
}

export function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = new Date(first)
  const weekday = (first.getDay() + 6) % 7
  start.setDate(first.getDate() - weekday)
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    return d
  })
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  OPEN: 'К выполнению',
  IN_PROGRESS: 'В работе',
  DONE: 'Готово',
  CANCELLED: 'Отменено',
}

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  URGENT: 'Срочно',
}

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

export function progress(task: Task): { done: number; total: number } {
  const total = task.checklist.length
  const done = task.checklist.filter((item) => item.done).length
  return { done, total }
}
