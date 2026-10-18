import { UserRole } from '@prisma/client';
import { bypassesSpaceMembership, canManageTasks, hasCompanyWorkScope, removesGlobalAdmin } from './user-role';

describe('user role policy', () => {
  it('gives company work scope to admin and project manager only', () => {
    expect(hasCompanyWorkScope(UserRole.GLOBAL_ADMIN)).toBe(true);
    expect(hasCompanyWorkScope(UserRole.PROJECT_MANAGER)).toBe(true);
    expect(hasCompanyWorkScope(UserRole.MEMBER)).toBe(false);
  });

  it('lets a project manager manage tasks in every space, including system lists', () => {
    expect(canManageTasks(UserRole.PROJECT_MANAGER)).toBe(true);
    expect(canManageTasks(UserRole.GLOBAL_ADMIN)).toBe(true);
    expect(canManageTasks(UserRole.MEMBER)).toBe(false);
  });

  it('lets a project manager manage operational spaces and not system ones', () => {
    expect(bypassesSpaceMembership(UserRole.PROJECT_MANAGER, false)).toBe(true);
    expect(bypassesSpaceMembership(UserRole.PROJECT_MANAGER, true)).toBe(false);
    expect(bypassesSpaceMembership(UserRole.GLOBAL_ADMIN, true)).toBe(true);
    expect(bypassesSpaceMembership(UserRole.MEMBER, false)).toBe(false);
  });

  it('treats a switch to project manager as removing the last admin', () => {
    expect(removesGlobalAdmin(UserRole.GLOBAL_ADMIN, UserRole.PROJECT_MANAGER, false)).toBe(true);
    expect(removesGlobalAdmin(UserRole.GLOBAL_ADMIN, UserRole.MEMBER, false)).toBe(true);
    expect(removesGlobalAdmin(UserRole.GLOBAL_ADMIN, UserRole.GLOBAL_ADMIN, false)).toBe(false);
    expect(removesGlobalAdmin(UserRole.GLOBAL_ADMIN, undefined, true)).toBe(true);
    expect(removesGlobalAdmin(UserRole.PROJECT_MANAGER, UserRole.MEMBER, false)).toBe(false);
  });
});
