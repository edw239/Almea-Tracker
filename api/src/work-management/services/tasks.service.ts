import { Injectable } from '@nestjs/common';
import { NotificationCode, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { ASSIGNEE_ONLY_FIELDS } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskAccessService } from '../access/task-access.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { afterCursorWhere, clampPageSize, decodeCursor, encodeCursor } from '../utils/task-cursor.util';
import { filtersToPrisma, parseFilters } from '../utils/task-filter.util';
import { nextPosition, positionAfter, renumberPositions } from '../utils/task-position.util';
import { TaskCollabService } from './task-collab.service';
import { TaskListStatusesService } from './task-list-statuses.service';
import { TaskNotificationsService } from './task-notifications.service';

type CreateInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  parentTaskId?: string;
};

type UpdateInput = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  listStatusId?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeIds?: string[];
  domainEntityId?: string | null;
  domainEntityType?: string | null;
  domainLabel?: string | null;
};

type MoveInput = {
  listId?: string;
  status?: TaskStatus;
  listStatusId?: string;
  afterTaskId?: string | null;
  position?: number;
};

type BulkInput = {
  taskIds: string[];
  status?: TaskStatus;
  listStatusId?: string;
  priority?: TaskPriority;
  assigneeIds?: string[];
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceAccess: TaskSpaceAccessService,
    private readonly taskAccess: TaskAccessService,
    private readonly statuses: TaskListStatusesService,
    private readonly collab: TaskCollabService,
    private readonly notifications: TaskNotificationsService,
  ) {}

  async statusesForList(user: AuthUser, listId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, isArchived: false },
    });
    if (!list) {
      throw AppError.notFound();
    }
    await this.spaceAccess.getVisibleSpace(user, list.spaceId);
    return this.statuses.resolveForList(listId);
  }

  async listByList(
    user: AuthUser,
    listId: string,
    opts: { filters?: string; cursor?: string; limit?: number } = {},
  ) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, isArchived: false },
    });
    if (!list) {
      throw AppError.notFound();
    }
    await this.spaceAccess.getVisibleSpace(user, list.spaceId);
    const filterTree = parseFilters(opts.filters ?? null);
    const cursor = decodeCursor(opts.cursor ?? null);
    const take = clampPageSize(opts.limit);
    const where: Prisma.TaskWhereInput = {
      listId,
      deletedAt: null,
      parentTaskId: null,
      ...(filterTree ? (filtersToPrisma(filterTree) as Prisma.TaskWhereInput) : {}),
      ...(cursor ? afterCursorWhere(cursor) : {}),
    };
    const rows = await this.prisma.task.findMany({
      where,
      orderBy: [{ position: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
      take: take + 1,
      include: {
        assignees: true,
        checklist: { orderBy: { position: 'asc' } },
        _count: { select: { children: true } },
      },
    });
    const hasMore = rows.length > take;
    const items = hasMore ? rows.slice(0, take) : rows;
    const last = items.at(-1);
    return {
      items,
      nextCursor: hasMore && last
        ? encodeCursor({
            position: last.position,
            createdAt: last.createdAt.toISOString(),
            id: last.id,
          })
        : null,
    };
  }

  async myWork(user: AuthUser) {
    return this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        OR: [{ ownerUserId: user.id }, { assignees: { some: { userId: user.id } } }],
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      include: { assignees: true, list: { select: { id: true, name: true, spaceId: true } } },
    });
  }

  async overdue(user: AuthUser) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const scope = await this.spaceAccess.listVisibleSpaceIds(user);
    return this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        dueDate: { lt: start },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        ...(scope === 'all'
          ? {}
          : {
              OR: [
                { ownerUserId: user.id },
                { assignees: { some: { userId: user.id } } },
                { list: { space: { OR: [{ isSystem: true }, { id: { in: scope } }] } } },
              ],
            }),
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      include: { assignees: true, list: { select: { id: true, name: true, spaceId: true } } },
    });
  }

  async kanban(user: AuthUser, listId: string) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, isArchived: false },
    });
    if (!list) {
      throw AppError.notFound();
    }
    await this.spaceAccess.getVisibleSpace(user, list.spaceId);
    const columns = await this.statuses.resolveForList(listId);
    const tasks = await this.prisma.task.findMany({
      where: { listId, deletedAt: null, parentTaskId: null },
      orderBy: { position: 'asc' },
      include: { assignees: true },
    });
    return {
      columns: columns.filter((item) => item.category !== TaskStatus.CANCELLED),
      tasks,
    };
  }

  async getById(user: AuthUser, taskId: string) {
    const task = await this.taskAccess.getVisibleTask(user, taskId);
    return this.prisma.task.findFirstOrThrow({
      where: { id: task.id },
      include: {
        assignees: true,
        watchers: true,
        checklist: { orderBy: { position: 'asc' } },
        comments: { orderBy: { createdAt: 'desc' }, take: 50 },
        activities: { orderBy: { createdAt: 'desc' }, take: 50 },
        relationsFrom: true,
        relationsTo: true,
        children: { where: { deletedAt: null }, orderBy: { position: 'asc' } },
        list: { select: { id: true, name: true, spaceId: true } },
      },
    });
  }

  async createInList(user: AuthUser, listId: string, input: CreateInput) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: listId, isArchived: false },
    });
    if (!list) {
      throw AppError.notFound();
    }
    await this.spaceAccess.assertCanCreateTaskInList(user, list);
    if (input.parentTaskId) {
      const parent = await this.prisma.task.findFirst({
        where: { id: input.parentTaskId, listId, deletedAt: null },
      });
      if (!parent) {
        throw AppError.notFound('Родительская задача не найдена');
      }
    }
    const columns = await this.statuses.resolveForList(listId);
    const open = this.statuses.defaultForCategory(columns, TaskStatus.OPEN);
    const last = await this.prisma.task.findFirst({
      where: { listId, deletedAt: null, parentTaskId: null },
      orderBy: { position: 'desc' },
    });
    return this.prisma.task.create({
      data: {
        listId,
        parentTaskId: input.parentTaskId ?? null,
        ownerUserId: user.id,
        title: input.title.trim(),
        description: input.description?.trim(),
        status: TaskStatus.OPEN,
        listStatusId: open?.id ?? null,
        priority: input.priority ?? TaskPriority.MEDIUM,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        position: nextPosition(last?.position),
        assignees: { create: { userId: user.id } },
      },
      include: { assignees: true },
    });
  }

  async update(user: AuthUser, taskId: string, input: UpdateInput) {
    const level = await this.taskAccess.resolveLevel(user, taskId);
    if (level === 'view') {
      throw AppError.forbidden();
    }
    if (level === 'assignee') {
      const keys = Object.keys(input).filter((key) => input[key as keyof UpdateInput] !== undefined);
      const forbidden = keys.filter(
        (key) => !ASSIGNEE_ONLY_FIELDS.includes(key as (typeof ASSIGNEE_ONLY_FIELDS)[number]),
      );
      if (forbidden.length > 0) {
        throw AppError.forbidden();
      }
    }
    const task = await this.prisma.task.findFirstOrThrow({
      where: { id: taskId, deletedAt: null },
      include: { assignees: true },
    });
    const previousDue = task.dueDate;
    const previousAssigneeIds = task.assignees.map((item) => item.userId);
    const previousStatus = task.status;
    const columns = await this.statuses.resolveForList(task.listId);
    const synced = this.syncDualStatus(task, columns, input);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (input.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map((userId) => ({ taskId, userId })),
            skipDuplicates: true,
          });
        }
      }
      return tx.task.update({
        where: { id: taskId },
        data: {
          title: input.title?.trim(),
          description: input.description,
          status: synced.status,
          listStatusId: synced.listStatusId,
          priority: input.priority,
          dueDate: input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null,
          completedAt: synced.completedAt,
          domainEntityId: input.domainEntityId === undefined ? undefined : input.domainEntityId,
          domainEntityType: input.domainEntityType === undefined ? undefined : input.domainEntityType,
          domainLabel: input.domainLabel === undefined ? undefined : input.domainLabel,
        },
        include: { assignees: true, checklist: true },
      });
    });
    if (input.dueDate !== undefined) {
      await this.collab.shiftDependentDueDates(user.id, taskId, previousDue, updated.dueDate);
    }
    if (input.assigneeIds) {
      const added = input.assigneeIds.filter((id) => !previousAssigneeIds.includes(id));
      await this.notifications.notify({
        userIds: added,
        actorUserId: user.id,
        code: NotificationCode.TASK_ASSIGNED,
        title: 'Вас назначили',
        body: updated.title,
        taskId,
      });
    }
    if (synced.status !== previousStatus) {
      const recipients = [
        ...updated.assignees.map((item) => item.userId),
        ...(await this.prisma.taskWatcher.findMany({ where: { taskId }, select: { userId: true } })).map(
          (item) => item.userId,
        ),
      ];
      await this.notifications.notify({
        userIds: recipients,
        actorUserId: user.id,
        code: NotificationCode.TASK_STATUS_CHANGED,
        title: 'Статус изменён',
        body: `${updated.title} → ${synced.status}`,
        taskId,
        dedupKey: `status:${taskId}:${synced.status}:${new Date().toISOString().slice(0, 10)}`,
      });
    }
    return updated;
  }

  async move(user: AuthUser, taskId: string, input: MoveInput) {
    const level = await this.taskAccess.resolveLevel(user, taskId);
    if (level === 'view') {
      throw AppError.forbidden();
    }
    const task = await this.prisma.task.findFirstOrThrow({
      where: { id: taskId, deletedAt: null },
      include: { list: true },
    });

    const targetListId = input.listId ?? task.listId;
    const listChanged = targetListId !== task.listId;

    if (level === 'assignee') {
      if (listChanged || input.position !== undefined) {
        // assignee may change status/listStatus/position within same list via afterTaskId
        if (listChanged) {
          throw AppError.forbidden();
        }
      }
      const allowedKeys = ['status', 'listStatusId', 'afterTaskId', 'position'] as const;
      const keys = Object.keys(input).filter((key) => input[key as keyof MoveInput] !== undefined);
      const forbidden = keys.filter((key) => !allowedKeys.includes(key as (typeof allowedKeys)[number]));
      if (forbidden.length > 0 || (keys.includes('listId') && listChanged)) {
        throw AppError.forbidden();
      }
    }

    if (listChanged) {
      const targetList = await this.prisma.taskList.findFirst({
        where: { id: targetListId, isArchived: false },
      });
      if (!targetList) {
        throw AppError.notFound('Список не найден');
      }
      await this.spaceAccess.assertCanCreateTaskInList(user, targetList);
    }

    return this.prisma.$transaction(async (tx) => {
      const columns = await this.statuses.resolveForList(targetListId);
      const synced = this.syncDualStatus(
        { status: task.status, listStatusId: task.listStatusId, completedAt: task.completedAt },
        columns,
        { status: input.status, listStatusId: input.listStatusId },
      );

      let position = task.position;
      if (input.position != null && Number.isFinite(input.position)) {
        position = input.position;
      } else if (input.afterTaskId !== undefined || listChanged) {
        position = await this.resolvePositionInTx(tx, targetListId, taskId, input.afterTaskId ?? null);
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          listId: targetListId,
          status: synced.status,
          listStatusId: synced.listStatusId,
          completedAt: synced.completedAt,
          position,
        },
        include: { assignees: true },
      });
    });
  }

  async bulkUpdate(user: AuthUser, input: BulkInput) {
    if (!input.taskIds.length) {
      throw AppError.notFound('Нет задач');
    }
    if (
      input.status === undefined &&
      input.listStatusId === undefined &&
      input.priority === undefined &&
      input.assigneeIds === undefined
    ) {
      throw AppError.forbidden();
    }
    const results = [];
    for (const taskId of input.taskIds) {
      await this.taskAccess.assertCanManageTask(user, taskId);
      const task = await this.prisma.task.findFirstOrThrow({ where: { id: taskId, deletedAt: null } });
      const columns = await this.statuses.resolveForList(task.listId);
      const synced = this.syncDualStatus(task, columns, {
        status: input.status,
        listStatusId: input.listStatusId,
      });
      const updated = await this.prisma.$transaction(async (tx) => {
        if (input.assigneeIds) {
          await tx.taskAssignee.deleteMany({ where: { taskId } });
          if (input.assigneeIds.length > 0) {
            await tx.taskAssignee.createMany({
              data: input.assigneeIds.map((userId) => ({ taskId, userId })),
              skipDuplicates: true,
            });
          }
        }
        return tx.task.update({
          where: { id: taskId },
          data: {
            status: synced.status,
            listStatusId: synced.listStatusId,
            completedAt: synced.completedAt,
            priority: input.priority,
          },
          include: { assignees: true },
        });
      });
      results.push(updated);
    }
    return results;
  }

  private syncDualStatus(
    task: { status: TaskStatus; listStatusId: string | null; completedAt: Date | null },
    columns: Array<{ id: string; category: TaskStatus; isDefault: boolean }>,
    input: { status?: TaskStatus; listStatusId?: string },
  ) {
    let status = task.status;
    let listStatusId = task.listStatusId;
    let completedAt = task.completedAt;

    if (input.listStatusId) {
      const column = columns.find((item) => item.id === input.listStatusId);
      if (!column) {
        throw AppError.notFound('Статус списка не найден');
      }
      listStatusId = column.id;
      status = column.category;
    } else if (input.status) {
      status = input.status;
      listStatusId = this.statuses.defaultForCategory(columns, input.status)?.id ?? listStatusId;
    }

    if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
      completedAt = new Date();
    } else if (status !== TaskStatus.DONE) {
      completedAt = null;
    }

    return { status, listStatusId, completedAt };
  }

  private async resolvePositionInTx(
    tx: Prisma.TransactionClient,
    listId: string,
    movingTaskId: string,
    afterTaskId: string | null,
  ): Promise<number> {
    const siblings = await tx.task.findMany({
      where: { listId, deletedAt: null, parentTaskId: null, id: { not: movingTaskId } },
      orderBy: { position: 'asc' },
      select: { id: true, position: true },
    });

    const attempt = positionAfter(siblings, afterTaskId);
    if (!attempt.needsRenumber) {
      return attempt.position;
    }

    const renumbered = renumberPositions(siblings);
    for (const item of renumbered) {
      await tx.task.update({ where: { id: item.id }, data: { position: item.position } });
    }
    const again = positionAfter(renumbered, afterTaskId);
    if (again.needsRenumber) {
      return nextPosition(renumbered.at(-1)?.position);
    }
    return again.position;
  }
}
