import { TaskGroupBy, TaskViewType, UserRole } from '@prisma/client';
import { TaskViewsService } from './task-views.service';

describe('TaskViewsService.createView', () => {
  it('allows personal view without manage', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'v1' });
    const prisma = {
      taskList: {
        findFirst: jest.fn().mockResolvedValue({ id: 'list-1', spaceId: 'space-1', isArchived: false }),
      },
      taskView: {
        findFirst: jest.fn().mockResolvedValue(null),
        create,
      },
    };
    const spaces = {
      getVisibleSpace: jest.fn().mockResolvedValue({ id: 'space-1' }),
      assertCanManageSpace: jest.fn(),
    };
    const service = new TaskViewsService(prisma as never, spaces as never);
    await service.createView(
      { id: 'u1', role: UserRole.MEMBER, email: 'a@b.c' },
      {
        listId: 'list-1',
        name: 'My board',
        viewType: TaskViewType.BOARD,
        groupBy: TaskGroupBy.STATUS,
        isShared: false,
      },
    );
    expect(spaces.assertCanManageSpace).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalled();
  });

  it('requires manage to share a view', async () => {
    const prisma = {
      taskList: {
        findFirst: jest.fn().mockResolvedValue({ id: 'list-1', spaceId: 'space-1', isArchived: false }),
      },
      taskView: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const spaces = {
      getVisibleSpace: jest.fn().mockResolvedValue({ id: 'space-1' }),
      assertCanManageSpace: jest.fn().mockRejectedValue(new Error('forbidden')),
    };
    const service = new TaskViewsService(prisma as never, spaces as never);
    await expect(
      service.createView(
        { id: 'u1', role: UserRole.MEMBER, email: 'a@b.c' },
        { listId: 'list-1', name: 'Shared', viewType: TaskViewType.LIST, isShared: true },
      ),
    ).rejects.toThrow('forbidden');
  });
});
