export const ACCOUNT_ROLES = ['MEMBER', 'PROJECT_MANAGER', 'GLOBAL_ADMIN'] as const

export type AccountRole = (typeof ACCOUNT_ROLES)[number]

export function canManageProjects(role: string | null | undefined): boolean {
  return role === 'GLOBAL_ADMIN' || role === 'PROJECT_MANAGER'
}

export const ACCOUNT_ROLE_LABEL: Record<AccountRole, string> = {
  MEMBER: 'Участник',
  PROJECT_MANAGER: 'Проджект-менеджер',
  GLOBAL_ADMIN: 'Глобальный админ',
}
