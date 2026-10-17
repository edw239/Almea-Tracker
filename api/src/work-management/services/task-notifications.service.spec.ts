import { NotificationCode } from '@prisma/client';
import { TaskNotificationsService } from './task-notifications.service';

function mockPrisma(overrides?: {
  create?: jest.Mock;
  upsert?: jest.Mock;
  users?: Array<{
    id: string;
    timezone: string;
    quietHoursFrom: number | null;
    quietHoursTo: number | null;
    notificationSettings: Array<{ inApp: boolean }>;
  }>;
}) {
  const create = overrides?.create ?? jest.fn().mockResolvedValue({});
  const upsert = overrides?.upsert ?? jest.fn().mockResolvedValue({});
  const users =
    overrides?.users ??
    [
      {
        id: 'a',
        timezone: 'UTC',
        quietHoursFrom: null,
        quietHoursTo: null,
        notificationSettings: [],
      },
      {
        id: 'b',
        timezone: 'UTC',
        quietHoursFrom: null,
        quietHoursTo: null,
        notificationSettings: [],
      },
    ];
  return {
    user: { findMany: jest.fn().mockResolvedValue(users) },
    taskNotification: { create, upsert },
    create,
    upsert,
  };
}

describe('TaskNotificationsService.notify', () => {
  it('skips actor and deduplicates recipients', async () => {
    const prisma = mockPrisma();
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
    expect(prisma.create).toHaveBeenCalledTimes(2);
    expect(prisma.upsert).not.toHaveBeenCalled();
  });

  it('uses upsert when dedupKey is set', async () => {
    const prisma = mockPrisma({
      users: [
        {
          id: 'a',
          timezone: 'UTC',
          quietHoursFrom: null,
          quietHoursTo: null,
          notificationSettings: [],
        },
      ],
    });
    const service = new TaskNotificationsService(prisma as never);
    await service.notify({
      userIds: ['a'],
      code: NotificationCode.TASK_OVERDUE,
      title: 't',
      body: 'b',
      dedupKey: 'overdue:task:2026-08-17',
    });
    expect(prisma.upsert).toHaveBeenCalledTimes(1);
  });

  it('skips recipient when inApp is false', async () => {
    const prisma = mockPrisma({
      users: [
        {
          id: 'a',
          timezone: 'UTC',
          quietHoursFrom: null,
          quietHoursTo: null,
          notificationSettings: [{ inApp: false }],
        },
      ],
    });
    const service = new TaskNotificationsService(prisma as never);
    const count = await service.notify({
      userIds: ['a'],
      code: NotificationCode.TASK_COMMENT,
      title: 't',
      body: 'b',
    });
    expect(count).toBe(0);
    expect(prisma.create).not.toHaveBeenCalled();
  });
});
