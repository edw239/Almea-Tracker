import { UserRole } from '@prisma/client';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { TaskAccessService } from './task-access.service';

function actor(role: UserRole): AuthUser {
  return {
    id: 'user-1',
    email: 'lead@almea.ru',
    name: 'Lead',
    role,
    mustChangePassword: false,
  };
}

describe('TaskAccessService project manager', () => {
  const task = {
    id: 'task-1',
    list: { id: 'list-1', spaceId: 'space-host', space: { isSystem: true } },
    assignees: [] as Array<{ userId: string }>,
  };

  function service() {
    const prisma = {
      task: { findFirst: jest.fn().mockResolvedValue(task) },
      taskSpaceMember: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const spaces = {
      getVisibleSpace: jest.fn().mockResolvedValue({ id: 'space-host', isSystem: true, isArchived: false }),
    };
    return new TaskAccessService(prisma as never, spaces as never);
  }

  it('manages a task in a system space', async () => {
    await expect(service().resolveLevel(actor(UserRole.PROJECT_MANAGER), task.id)).resolves.toBe('manage');
  });

  it('leaves a non-member as a viewer', async () => {
    await expect(service().resolveLevel(actor(UserRole.MEMBER), task.id)).resolves.toBe('view');
  });
});
