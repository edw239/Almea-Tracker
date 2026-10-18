import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { TaskListStatusesService } from './task-list-statuses.service';
import { TaskStatusService } from './task-status.service';
import { resolveDualStatus, StatusReason } from '../utils/task-status.util';

@Injectable()
export class TaskListStatusesAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
    private readonly taskStatus: TaskStatusService,
  ) {}

  async createForList(
    user: AuthUser,
    listId: string,
    input: { name: string; color: string; category: TaskStatus; order?: number },
  ) {
    const list = await this.requireList(listId);
    await this.spaces.assertCanManageSpace(user, list.spaceId);
    await this.ensureListColumns(listId, list.spaceId);
    const max = await this.prisma.taskListStatus.aggregate({
      where: { listId },
      _max: { order: true },
    });
    const order = input.order ?? (max._max.order ?? -1) + 1;
    return this.prisma.taskListStatus.create({
      data: {
        spaceId: list.spaceId,
        listId,
        name: input.name.trim(),
        color: input.color,
        category: input.category,
        order,
        isDefault: false,
      },
    });
  }

  async update(user: AuthUser, statusId: string, input: Partial<{ name: string; color: string; category: TaskStatus; order: number; isDefault: boolean }>) {
    const row = await this.prisma.taskListStatus.findUnique({ where: { id: statusId } });
    if (!row || !row.listId) {
      throw AppError.notFound();
    }
    const list = await this.requireList(row.listId);
    await this.spaces.assertCanManageSpace(user, list.spaceId);

    if (input.isDefault === true && input.category) {
      await this.prisma.taskListStatus.updateMany({
        where: { listId: row.listId, category: input.category, id: { not: statusId } },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.taskListStatus.update({
      where: { id: statusId },
      data: {
        name: input.name?.trim(),
        color: input.color,
        category: input.category,
        order: input.order,
        isDefault: input.isDefault,
      },
    });

    if (input.category && input.category !== row.category) {
      const tasks = await this.prisma.task.findMany({
        where: { listStatusId: statusId, deletedAt: null },
      });
      const columns = await this.statuses.resolveForList(row.listId);
      await this.prisma.$transaction(async (tx) => {
        for (const task of tasks) {
          const synced = resolveDualStatus(task, columns, { listStatusId: statusId });
          synced.status = input.category!;
          const at = await this.taskStatus.commit(tx, {
            taskId: task.id,
            before: task,
            after: synced,
            columns,
            actorUserId: user.id,
            reason: StatusReason.UPDATE,
            sprintId: task.sprintId,
            storyPoints: task.storyPoints,
          });
          await tx.task.update({
            where: { id: task.id },
            data: {
              status: input.category,
              completedAt: synced.completedAt,
              statusChangedAt: at,
            },
          });
        }
      });
    }

    return updated;
  }

  async remove(user: AuthUser, statusId: string, reassignToStatusId?: string) {
    const row = await this.prisma.taskListStatus.findUnique({ where: { id: statusId } });
    if (!row || !row.listId) {
      throw AppError.notFound();
    }
    const list = await this.requireList(row.listId);
    await this.spaces.assertCanManageSpace(user, list.spaceId);

    const inUse = await this.prisma.task.count({
      where: { listStatusId: statusId, deletedAt: null },
    });
    if (inUse > 0) {
      if (!reassignToStatusId) {
        throw AppError.badRequest('Колонка используется — укажите reassignToStatusId');
      }
      const target = await this.prisma.taskListStatus.findFirst({
        where: { id: reassignToStatusId, listId: row.listId },
      });
      if (!target) {
        throw AppError.badRequest('Целевая колонка не найдена');
      }
      const tasks = await this.prisma.task.findMany({
        where: { listStatusId: statusId, deletedAt: null },
      });
      const columns = await this.statuses.resolveForList(row.listId);
      await this.prisma.$transaction(async (tx) => {
        for (const task of tasks) {
          const synced = resolveDualStatus(task, columns, { listStatusId: target.id });
          const at = await this.taskStatus.commit(tx, {
            taskId: task.id,
            before: task,
            after: synced,
            columns,
            actorUserId: user.id,
            reason: StatusReason.STATUS_DELETED,
            sprintId: task.sprintId,
            storyPoints: task.storyPoints,
          });
          await tx.task.update({
            where: { id: task.id },
            data: {
              listStatusId: target.id,
              status: synced.status,
              completedAt: synced.completedAt,
              statusChangedAt: at,
            },
          });
        }
      });
    }

    await this.prisma.taskListStatus.delete({ where: { id: statusId } });
    return { ok: true as const };
  }

  private async requireList(listId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) {
      throw AppError.notFound();
    }
    return list;
  }

  /** Copy space/inherited columns onto the list before first custom edit. */
  private async ensureListColumns(listId: string, spaceId: string) {
    const own = await this.prisma.taskListStatus.count({ where: { listId } });
    if (own > 0) {
      return;
    }
    await this.statuses.resolveForList(listId);
    const seeded = await this.prisma.taskListStatus.findMany({ where: { listId } });
    if (seeded.length > 0) {
      return;
    }
    const inherited = await this.prisma.taskListStatus.findMany({
      where: { spaceId, listId: null },
      orderBy: { order: 'asc' },
    });
    if (inherited.length === 0) {
      await this.statuses.seedDefaults(spaceId, listId);
      return;
    }
    await this.prisma.taskListStatus.createMany({
      data: inherited.map((item) => ({
        spaceId,
        listId,
        name: item.name,
        color: item.color,
        order: item.order,
        category: item.category,
        isDefault: item.isDefault,
      })),
    });
  }
}
