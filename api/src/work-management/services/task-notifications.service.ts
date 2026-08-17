import { Injectable } from '@nestjs/common';
import { NotificationCode, NotificationSeverity, TaskStatus } from '@prisma/client';
import { DUE_SOON_HOURS, NOTIFICATION_SNOOZE_HOURS_DEFAULT } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

const DEFAULT_SEVERITY: Record<NotificationCode, NotificationSeverity> = {
  TASK_ASSIGNED: NotificationSeverity.LOW,
  TASK_DUE_SOON: NotificationSeverity.MEDIUM,
  TASK_OVERDUE: NotificationSeverity.HIGH,
  TASK_MENTION: NotificationSeverity.HIGH,
  TASK_COMMENT: NotificationSeverity.LOW,
  TASK_REMINDER: NotificationSeverity.MEDIUM,
  TASK_STATUS_CHANGED: NotificationSeverity.LOW,
};

export type NotifyInput = {
  userIds: string[];
  actorUserId?: string;
  code: NotificationCode;
  title: string;
  body: string;
  taskId?: string | null;
  dedupKey?: string | null;
  severity?: NotificationSeverity;
};

@Injectable()
export class TaskNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(input: NotifyInput): Promise<number> {
    const recipients = [...new Set(input.userIds)].filter((id) => id && id !== input.actorUserId);
    if (recipients.length === 0) {
      return 0;
    }
    const severity = input.severity ?? DEFAULT_SEVERITY[input.code];
    let created = 0;
    for (const userId of recipients) {
      if (input.dedupKey) {
        const row = await this.prisma.taskNotification.upsert({
          where: { userId_dedupKey: { userId, dedupKey: input.dedupKey } },
          create: {
            userId,
            code: input.code,
            severity,
            title: input.title,
            body: input.body,
            taskId: input.taskId ?? null,
            dedupKey: input.dedupKey,
          },
          update: {
            title: input.title,
            body: input.body,
            severity,
            taskId: input.taskId ?? null,
            clearedAt: null,
            snoozedUntil: null,
            readAt: null,
          },
        });
        if (row) created += 1;
      } else {
        await this.prisma.taskNotification.create({
          data: {
            userId,
            code: input.code,
            severity,
            title: input.title,
            body: input.body,
            taskId: input.taskId ?? null,
          },
        });
        created += 1;
      }
    }
    return created;
  }

  async listInbox(user: AuthUser) {
    await this.scanDueBuckets(user.id);
    const now = new Date();
    return this.prisma.taskNotification.findMany({
      where: {
        userId: user.id,
        clearedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      orderBy: [{ readAt: 'asc' }, { createdAt: 'desc' }],
      take: 100,
    });
  }

  async unreadCount(user: AuthUser) {
    const now = new Date();
    return this.prisma.taskNotification.count({
      where: {
        userId: user.id,
        clearedAt: null,
        readAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
    });
  }

  async markRead(user: AuthUser, id: string) {
    const row = await this.requireOwn(user.id, id);
    if (row.readAt) return row;
    return this.prisma.taskNotification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(user: AuthUser) {
    const now = new Date();
    await this.prisma.taskNotification.updateMany({
      where: {
        userId: user.id,
        clearedAt: null,
        readAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      data: { readAt: now },
    });
    return { ok: true };
  }

  async snooze(user: AuthUser, id: string, hours = NOTIFICATION_SNOOZE_HOURS_DEFAULT) {
    if (!Number.isFinite(hours) || hours < 1 || hours > 168) {
      throw AppError.badRequest('snooze hours: 1..168');
    }
    await this.requireOwn(user.id, id);
    const until = new Date(Date.now() + hours * 3600_000);
    return this.prisma.taskNotification.update({
      where: { id },
      data: { snoozedUntil: until, readAt: new Date() },
    });
  }

  async clear(user: AuthUser, id: string) {
    await this.requireOwn(user.id, id);
    return this.prisma.taskNotification.update({
      where: { id },
      data: { clearedAt: new Date(), readAt: new Date() },
    });
  }

  /**
   * Lightweight due scan without a separate scheduler process.
   * Dedup per user/task/day so inbox refresh is safe.
   */
  async scanDueBuckets(userId: string) {
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const soonEnd = new Date(now.getTime() + DUE_SOON_HOURS * 3600_000);
    const dayKey = start.toISOString().slice(0, 10);

    const mine = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        dueDate: { not: null },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        OR: [{ ownerUserId: userId }, { assignees: { some: { userId } } }],
      },
      select: { id: true, title: true, dueDate: true },
      take: 200,
    });

    for (const task of mine) {
      if (!task.dueDate) continue;
      const due = task.dueDate;
      if (due < start) {
        await this.notify({
          userIds: [userId],
          code: NotificationCode.TASK_OVERDUE,
          title: 'Просрочено',
          body: task.title,
          taskId: task.id,
          dedupKey: `overdue:${task.id}:${dayKey}`,
        });
      } else if (due <= soonEnd) {
        await this.notify({
          userIds: [userId],
          code: NotificationCode.TASK_DUE_SOON,
          title: 'Срок сегодня / скоро',
          body: task.title,
          taskId: task.id,
          dedupKey: `due-soon:${task.id}:${dayKey}`,
        });
      }
    }
  }

  private async requireOwn(userId: string, id: string) {
    const row = await this.prisma.taskNotification.findFirst({ where: { id, userId } });
    if (!row || row.clearedAt) {
      throw AppError.notFound();
    }
    return row;
  }
}
