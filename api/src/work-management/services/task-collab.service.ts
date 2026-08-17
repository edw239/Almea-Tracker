import { Injectable } from '@nestjs/common';
import { NotificationCode, TaskRelationType } from '@prisma/client';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskAccessService } from '../access/task-access.service';
import { TaskNotificationsService } from './task-notifications.service';

const MENTION_RE = /@\[([0-9a-f-]{36})\]/gi;

@Injectable()
export class TaskCollabService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TaskAccessService,
    private readonly notifications: TaskNotificationsService,
  ) {}

  async listComments(user: AuthUser, taskId: string) {
    await this.access.getVisibleTask(user, taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addComment(user: AuthUser, taskId: string, body: string) {
    const task = await this.access.getVisibleTask(user, taskId);
    const text = body.trim();
    if (!text) {
      throw AppError.badRequest('Пустой комментарий');
    }
    const comment = await this.prisma.taskComment.create({
      data: { taskId, userId: user.id, body: text },
    });
    await this.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId, userId: user.id } },
      create: { taskId, userId: user.id },
      update: {},
    });
    await this.prisma.taskActivity.create({
      data: { taskId, userId: user.id, action: 'COMMENT_ADDED', details: { commentId: comment.id } },
    });

    const mentions = this.extractMentions(text);
    if (mentions.length > 0) {
      await this.notifications.notify({
        userIds: mentions,
        actorUserId: user.id,
        code: NotificationCode.TASK_MENTION,
        title: 'Вас упомянули',
        body: task.title,
        taskId,
      });
    }
    const watchers = await this.prisma.taskWatcher.findMany({
      where: { taskId, userId: { not: user.id } },
      select: { userId: true },
    });
    const mentionSet = new Set(mentions);
    await this.notifications.notify({
      userIds: watchers.map((item) => item.userId).filter((id) => !mentionSet.has(id)),
      actorUserId: user.id,
      code: NotificationCode.TASK_COMMENT,
      title: 'Новый комментарий',
      body: task.title,
      taskId,
    });

    return comment;
  }

  extractMentions(body: string): string[] {
    const ids = new Set<string>();
    for (const match of body.matchAll(MENTION_RE)) {
      if (match[1]) ids.add(match[1]);
    }
    return [...ids];
  }

  async listChecklist(user: AuthUser, taskId: string) {
    await this.access.getVisibleTask(user, taskId);
    return this.prisma.checklistItem.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });
  }

  async addChecklistItem(user: AuthUser, taskId: string, text: string) {
    await this.access.assertCanManageTask(user, taskId);
    const last = await this.prisma.checklistItem.findFirst({
      where: { taskId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.checklistItem.create({
      data: {
        taskId,
        text: text.trim(),
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  async toggleChecklistItem(user: AuthUser, taskId: string, itemId: string) {
    await this.access.getVisibleTask(user, taskId);
    const item = await this.prisma.checklistItem.findFirst({ where: { id: itemId, taskId } });
    if (!item) {
      throw AppError.notFound();
    }
    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { isDone: !item.isDone },
    });
  }

  async addWatcher(user: AuthUser, taskId: string, userId: string) {
    await this.access.assertCanManageTask(user, taskId);
    return this.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId, userId } },
      create: { taskId, userId },
      update: {},
    });
  }

  async removeWatcher(user: AuthUser, taskId: string, userId: string) {
    await this.access.assertCanManageTask(user, taskId);
    await this.prisma.taskWatcher.deleteMany({ where: { taskId, userId } });
    return { ok: true };
  }

  async listRelations(user: AuthUser, taskId: string) {
    await this.access.getVisibleTask(user, taskId);
    return this.prisma.taskRelation.findMany({
      where: { OR: [{ fromTaskId: taskId }, { toTaskId: taskId }] },
    });
  }

  async addRelation(
    user: AuthUser,
    taskId: string,
    toTaskId: string,
    relationType: TaskRelationType,
  ) {
    await this.access.assertCanManageTask(user, taskId);
    if (taskId === toTaskId) {
      throw AppError.badRequest('Self-link запрещён');
    }
    await this.access.getVisibleTask(user, toTaskId);
    const created = await this.prisma.taskRelation.create({
      data: { fromTaskId: taskId, toTaskId, relationType },
    });
    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'RELATION_ADDED',
        details: { toTaskId, relationType },
      },
    });
    return created;
  }

  async removeRelation(user: AuthUser, taskId: string, relationId: string) {
    await this.access.assertCanManageTask(user, taskId);
    const relation = await this.prisma.taskRelation.findFirst({
      where: { id: relationId, OR: [{ fromTaskId: taskId }, { toTaskId: taskId }] },
    });
    if (!relation) {
      throw AppError.notFound();
    }
    await this.prisma.taskRelation.delete({ where: { id: relationId } });
    await this.prisma.taskActivity.create({
      data: {
        taskId,
        userId: user.id,
        action: 'RELATION_REMOVED',
        details: { relationId },
      },
    });
    return { ok: true };
  }

  /**
   * When blocker due shifts, shift dependent (outgoing BLOCKS) due dates by the same delta.
   */
  async shiftDependentDueDates(userId: string, taskId: string, previousDue: Date | null, nextDue: Date | null) {
    if (!previousDue || !nextDue) return;
    const deltaMs = nextDue.getTime() - previousDue.getTime();
    if (deltaMs === 0) return;
    const outgoing = await this.prisma.taskRelation.findMany({
      where: { fromTaskId: taskId, relationType: TaskRelationType.BLOCKS },
    });
    for (const edge of outgoing) {
      const dependent = await this.prisma.task.findFirst({
        where: { id: edge.toTaskId, deletedAt: null },
      });
      if (!dependent?.dueDate) continue;
      const shifted = new Date(dependent.dueDate.getTime() + deltaMs);
      await this.prisma.task.update({
        where: { id: dependent.id },
        data: { dueDate: shifted },
      });
      await this.prisma.taskActivity.create({
        data: {
          taskId: dependent.id,
          userId,
          action: 'UPDATED',
          details: { reason: 'shifted_by_blocker', fromTaskId: taskId },
        },
      });
    }
  }

  async listActivity(user: AuthUser, taskId: string) {
    await this.access.getVisibleTask(user, taskId);
    return this.prisma.taskActivity.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
