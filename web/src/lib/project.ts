export const PROJECT_STATUSES = ['DRAFT', 'ACTIVE', 'ON_HOLD', 'CLOSED'] as const
export type ProjectStatusName = (typeof PROJECT_STATUSES)[number]
export type ProjectSignalName = 'red' | 'amber' | 'green'

export const PROJECT_STATUS_LABEL: Record<ProjectStatusName, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'В работе',
  ON_HOLD: 'Пауза',
  CLOSED: 'Закрыт',
}

export const PROJECT_SIGNAL_LABEL: Record<ProjectSignalName, string> = {
  red: 'Срок прошёл',
  amber: 'Срок близко',
  green: 'В сроке',
}

export function signalVariant(
  signal: ProjectSignalName | null,
): 'destructive' | 'warning' | 'success' | 'muted' {
  if (signal === 'red') return 'destructive'
  if (signal === 'amber') return 'warning'
  if (signal === 'green') return 'success'
  return 'muted'
}
