import { NotificationCode } from '@prisma/client';
import { TaskNotificationsService } from './task-notifications.service';

describe('TaskNotificationsService.notify', () => {
  it('skips actor and deduplicates recipients', async () => {
    const create = jest.fn().mockResolvedValue({});
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      taskNotification: { create, upsert },
    };
    const service = new TaskNotificationsService(prisma as never);
    const count = await service.notify({
      userIds: ['a', 'a', 'b', 'actor'],
      actorUserId: 'actor',
      code: NotificationCode.TASK_ASSIGNED,
      title: 't',
      body: 'b',
      taskId: 'task-1',
    });
    expect(count).toBe(2);
    expect(create).toHaveBeenCalledTimes(2);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('uses upsert when dedupKey is set', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const prisma = {
      taskNotification: { create: jest.fn(), upsert },
    };
    const service = new TaskNotificationsService(prisma as never);
    await service.notify({
      userIds: ['a'],
      code: NotificationCode.TASK_OVERDUE,
      title: 't',
      body: 'b',
      dedupKey: 'overdue:task:2026-08-17',
    });
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
