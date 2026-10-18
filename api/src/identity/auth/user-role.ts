import { UserRole } from '@prisma/client';

/** Lead who runs company work. Account administration stays with GLOBAL_ADMIN. */
export function hasCompanyWorkScope(role: UserRole): boolean {
  return role === UserRole.GLOBAL_ADMIN || role === UserRole.PROJECT_MANAGER;
}

export function isGlobalAdmin(role: UserRole): boolean {
  return role === UserRole.GLOBAL_ADMIN;
}

/**
 * Membership bypass for space structure (folders, lists, columns).
 * System spaces stay admin-only so a lead cannot reshape personal inbox or host.
 */
export function bypassesSpaceMembership(role: UserRole, isSystem: boolean): boolean {
  if (isGlobalAdmin(role)) return true;
  return role === UserRole.PROJECT_MANAGER && !isSystem;
}

/**
 * Task work, including lists inside system spaces.
 * Brand lists and the shared inbox live there; without this a lead can see a task and cannot accept it.
 */
export function canManageTasks(role: UserRole): boolean {
  return hasCompanyWorkScope(role);
}

/** Any step off GLOBAL_ADMIN, including a switch to project manager. */
export function removesGlobalAdmin(
  current: UserRole,
  nextRole: UserRole | undefined,
  deactivating: boolean,
): boolean {
  if (current !== UserRole.GLOBAL_ADMIN) return false;
  if (deactivating) return true;
  return nextRole !== undefined && nextRole !== UserRole.GLOBAL_ADMIN;
}
