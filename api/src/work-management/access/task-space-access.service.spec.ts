import { UserRole } from '@prisma/client';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { TaskSpaceAccessService } from './task-space-access.service';

function actor(role: UserRole): AuthUser {
  return {
    id: 'user-1',
    email: 'lead@almea.ru',
    name: 'Lead',
    role,
    mustChangePassword: false,
  };
}

describe('TaskSpaceAccessService project manager', () => {
  const ops = { id: 'space-ops', isSystem: false, isArchived: false };
  const personal = { id: 'space-personal', isSystem: true, isArchived: false };

  function service(space: typeof ops | null) {
    const prisma = {
      taskSpace: {
        findUnique: jest.fn().mockResolvedValue(space),
        findFirst: jest.fn(),
      },
      taskSpaceMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    return { service: new TaskSpaceAccessService(prisma as never), prisma };
  }

  it('sees an operational space without membership', async () => {
    const { service: access } = service(ops);
    await expect(access.getVisibleSpace(actor(UserRole.PROJECT_MANAGER), ops.id)).resolves.toEqual(ops);
  });

  it('can manage an operational space and not a system space', async () => {
    const operational = service(ops);
    await expect(
      operational.service.assertCanManageSpace(actor(UserRole.PROJECT_MANAGER), ops.id),
    ).resolves.toEqual(ops);

    const system = service(personal);
    await expect(
      system.service.assertCanManageSpace(actor(UserRole.PROJECT_MANAGER), personal.id),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('lists every space', async () => {
    const { service: access } = service(ops);
    await expect(access.listVisibleSpaceIds(actor(UserRole.PROJECT_MANAGER))).resolves.toBe('all');
  });

  it('creates a task in a system list and still cannot reshape that space', async () => {
    const { service: access } = service(personal);
    await expect(
      access.assertCanCreateTaskInList(actor(UserRole.PROJECT_MANAGER), {
        id: 'list-brand',
        spaceId: personal.id,
        systemKey: 'entity:brand:xlash',
        isArchived: false,
      }),
    ).resolves.toBeUndefined();
    await expect(
      access.assertCanManageSpace(actor(UserRole.PROJECT_MANAGER), personal.id),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('refuses a member creating a task in a system list that is not the inbox', async () => {
    const { service: access } = service(personal);
    await expect(
      access.assertCanCreateTaskInList(actor(UserRole.MEMBER), {
        id: 'list-brand',
        spaceId: personal.id,
        systemKey: 'entity:brand:xlash',
        isArchived: false,
      }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it('still hides an operational space from a member who is not in it', async () => {
    const { service: access } = service(ops);
    await expect(access.getVisibleSpace(actor(UserRole.MEMBER), ops.id)).rejects.toBeInstanceOf(AppError);
  });
});
