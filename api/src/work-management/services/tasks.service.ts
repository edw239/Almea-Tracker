import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { NotificationCode, Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { EPIC_TYPE_KEY, STORY_POINTS_MAX, TASK_KEY_PATTERN } from '../../common/constants';
import { ASSIGNEE_ONLY_FIELDS, STUCK_REASON_MAX_LENGTH } from '../../common/constants';
import { AppError, ErrorCode } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskAccessService } from '../access/task-access.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { afterCursorWhere, clampPageSize, decodeCursor, encodeCursor } from '../utils/task-cursor.util';
import { filtersToPrisma, parseFilters } from '../utils/task-filter.util';
import {
  buildMyWorkWhere,
  isKnownMyWorkScope,
  parseMyWorkScope,
  type MyWorkScope,
} from '../utils/my-work-scope.util';
import { nextPosition, positionAfter, renumberPositions } from '../utils/task-position.util';
import {
  assertDelegationHasDue,
  resolveCreateAssigneeIds,
} from '../utils/task-delegation.util';
import { isInReviewColumn, resolveReviewRequired } from '../utils/task-review.util';
import { TaskCollabService } from './task-collab.service';
import { HostEntitiesService } from './host-entities.service';
import { TaskListStatusesService } from './task-list-statuses.service';
import { TaskNotificationsService } from './task-notifications.service';
import { TaskIdentityService } from './task-identity.service';
import { TaskStatusService } from './task-status.service';
import { SprintsService } from '../boards/sprints.service';
import { isBacklogColumn, resolveDualStatus, StatusReason } from '../utils/task-status.util';

type CreateInput = {
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  assigneeIds?: string[];
  reviewRequired?: boolean;
  parentTaskId?: string;
  hostEntityId?: string | null;
  listStatusId?: string;
  taskTypeId?: string | null;
  epicId?: string | null;
  storyPoints?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
};

type UpdateInput = {
  title?: string;
  description?: string;
  status?: TaskStatus;
  listStatusId?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  assigneeIds?: string[];
  reviewRequired?: boolean;
  reviewRejectReason?: string;
  domainEntityId?: string | null;
  domainEntityType?: string | null;
  domainLabel?: string | null;
  hostEntityId?: string | null;
  taskTypeId?: string | null;
  epicId?: string | null;
  storyPoints?: number | null;
  labelIds?: string[];
  sprintId?: string | null;
};

type MoveInput = {
  listId?: string;
  status?: TaskStatus;
  listStatusId?: string;
  afterTaskId?: string | null;
  position?: number;
  reviewRejectReason?: string;
  rankBeforeId?: string | null;
  rankAfterId?: string | null;
  priority?: TaskPriority;
  epicId?: string | null;
  hostEntityId?: string | null;
  assigneeIds?: string[];
  dueDate?: string | null;
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
    private readonly hostEntities: HostEntitiesService,
    private readonly identity: TaskIdentityService,
    private readonly taskStatus: TaskStatusService,
    private readonly sprints: SprintsService,
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

  async myWork(user: AuthUser, scopeRaw?: string) {
    if (!isKnownMyWorkScope(scopeRaw)) {
      throw AppError.badRequest(
        'scope: default|assigned|owned|watching|mentions|checklist|created|waiting|untriaged|review',
      );
    }
    const scope: MyWorkScope = parseMyWorkScope(scopeRaw);
    return this.prisma.task.findMany({
      where: buildMyWorkWhere(user.id, scope),
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

  async getByKey(user: AuthUser, key: string) {
    const normalized = key.trim().toUpperCase();
    if (!TASK_KEY_PATTERN.test(normalized)) {
      throw AppError.badRequest('Некорректный ключ задачи');
    }
    const taskId = await this.identity.findTaskIdByKey(this.prisma, normalized);
    if (!taskId) {
      throw AppError.notFound();
    }
    return this.getById(user, taskId);
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
        labels: { include: { label: { select: { id: true, name: true } } } },
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
    const parent = input.parentTaskId
      ? await this.prisma.task.findFirst({
          where: { id: input.parentTaskId, listId, deletedAt: null },
        })
      : null;
    if (input.parentTaskId && !parent) {
      throw AppError.notFound('Родительская задача не найдена');
    }
    const columns = await this.statuses.resolveForList(listId);
    const chosen = input.listStatusId
      ? columns.find((column) => column.id === input.listStatusId)
      : this.statuses.defaultForCategory(columns, TaskStatus.OPEN);
    if (input.listStatusId && !chosen) {
      throw AppError.notFound('Статус списка не найден');
    }
    const hostLink = await this.resolveHostEntityLink(input.hostEntityId);
    const assigneeIds = resolveCreateAssigneeIds(user.id, input.assigneeIds);
    assertDelegationHasDue(user.id, assigneeIds, input.dueDate, {
      preparing: isBacklogColumn(columns, chosen?.id ?? null),
    });
    assertStoryPoints(input.storyPoints);
    const reviewRequired = resolveReviewRequired(user.id, assigneeIds, input.reviewRequired);
    const epicId = input.epicId === undefined ? (parent?.epicId ?? null) : input.epicId;
    const last = await this.prisma.task.findFirst({
      where: { listId, deletedAt: null, parentTaskId: null },
      orderBy: { position: 'desc' },
    });
    return this.prisma.$transaction(async (tx) => {
      if (epicId) {
        await this.assertEpicTarget(tx, {
          taskId: null,
          listId,
          taskTypeId: input.taskTypeId ?? null,
          epicId,
        });
      }
      const key = await this.identity.nextKey(tx, list.spaceId);
      const rank = await this.identity.nextRank(tx);
      const at = new Date();
      const status = chosen?.category ?? TaskStatus.OPEN;
      const created = await tx.task.create({
        data: {
          listId,
          parentTaskId: input.parentTaskId ?? null,
          ownerUserId: user.id,
          createdByUserId: user.id,
          title: input.title.trim(),
          description: input.description?.trim(),
          status,
          listStatusId: chosen?.id ?? null,
          priority: input.priority ?? TaskPriority.MEDIUM,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          position: nextPosition(last?.position),
          reviewRequired,
          key,
          rank,
          statusChangedAt: at,
          epicId,
          taskTypeId: input.taskTypeId ?? null,
          storyPoints: input.storyPoints ?? null,
          sprintId: input.sprintId ?? null,
          assignees:
            assigneeIds.length > 0
              ? { create: assigneeIds.map((assigneeId) => ({ userId: assigneeId })) }
              : undefined,
          ...(hostLink
            ? {
                hostEntityId: hostLink.id,
                domainEntityType: hostLink.entityType,
                domainEntityId: hostLink.id,
                domainLabel: hostLink.name,
              }
            : {}),
        },
        include: { assignees: true },
      });
      if (input.labelIds?.length) {
        await this.replaceLabels(tx, created.id, input.labelIds);
      }
      await this.taskStatus.commit(tx, {
        taskId: created.id,
        before: null,
        after: { status, listStatusId: chosen?.id ?? null, completedAt: null },
        columns,
        actorUserId: user.id,
        reason: StatusReason.CREATE,
        at,
      });
      return created;
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
    const nextAssigneeIds = input.assigneeIds ?? previousAssigneeIds;
    const nextDue =
      input.dueDate === undefined
        ? previousDue
          ? previousDue.toISOString()
          : null
        : input.dueDate;
    const columns = await this.statuses.resolveForList(task.listId);
    const synced = resolveDualStatus(task, columns, input);
    const preparing = isBacklogColumn(columns, synced.listStatusId);
    assertDelegationHasDue(user.id, nextAssigneeIds, nextDue, { preparing });
    assertStoryPoints(input.storyPoints);
    const reviewPatch = this.resolveReviewTransition({
      task,
      columns,
      synced,
      accessLevel: level,
      actorUserId: user.id,
      rejectReason: input.reviewRejectReason,
    });
    let nextReviewRequired = task.reviewRequired;
    if (input.reviewRequired !== undefined) {
      nextReviewRequired = input.reviewRequired;
    } else if (input.assigneeIds) {
      const anchor = task.createdByUserId ?? user.id;
      nextReviewRequired = resolveReviewRequired(anchor, nextAssigneeIds);
    }
    const hostLink =
      input.hostEntityId === undefined
        ? undefined
        : input.hostEntityId === null
          ? null
          : await this.resolveHostEntityLink(input.hostEntityId);
    const updated = await this.prisma.$transaction(async (tx) => {
      if (input.epicId !== undefined) {
        await this.assertEpicTarget(tx, {
          taskId,
          listId: task.listId,
          taskTypeId: input.taskTypeId === undefined ? task.taskTypeId : input.taskTypeId,
          epicId: input.epicId,
        });
      } else if (input.taskTypeId) {
        await this.assertNotNestingEpic(tx, taskId, input.taskTypeId, task.epicId);
      }
      if (input.labelIds) {
        await this.replaceLabels(tx, taskId, input.labelIds);
      }
      if (input.assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (input.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map((userId) => ({ taskId, userId })),
            skipDuplicates: true,
          });
        }
      }
      if (reviewPatch.rejectActivity) {
        await tx.taskActivity.create({
          data: {
            taskId,
            userId: user.id,
            action: 'REVIEW_REJECTED',
            details: { reason: reviewPatch.rejectActivity.reason },
          },
        });
      }
      const nextDueDate =
        input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null;
      let dueMoveIncrement = 0;
      if (input.dueDate !== undefined) {
        const prevMs = previousDue?.getTime() ?? null;
        const nextMs = nextDueDate?.getTime() ?? null;
        if (prevMs !== nextMs) {
          await tx.taskActivity.create({
            data: {
              taskId,
              userId: user.id,
              action: 'DUE_DATE_CHANGED',
              details: {
                from: previousDue?.toISOString() ?? null,
                to: nextDueDate?.toISOString() ?? null,
              },
            },
          });
          if (previousDue != null) {
            dueMoveIncrement = 1;
          }
        }
      }
      const statusAt = synced.changed
        ? await this.taskStatus.commit(tx, {
            taskId,
            before: {
              status: task.status,
              listStatusId: task.listStatusId,
              completedAt: task.completedAt,
            },
            after: synced,
            columns,
            actorUserId: user.id,
            reason: StatusReason.UPDATE,
            sprintId: input.sprintId === undefined ? task.sprintId : input.sprintId,
            storyPoints: input.storyPoints === undefined ? task.storyPoints : input.storyPoints,
          })
        : undefined;
      if (input.sprintId !== undefined && input.sprintId !== task.sprintId) {
        await this.sprints.noteMembership(tx, user.id, task, input.sprintId);
      }
      if (
        input.storyPoints !== undefined &&
        task.sprintId &&
        !samePoints(task.storyPoints, input.storyPoints)
      ) {
        await this.sprints.noteEstimate(tx, user.id, task.sprintId, taskId, input.storyPoints, task.storyPoints);
      }
      if (input.epicId !== undefined && input.epicId !== task.epicId) {
        await tx.task.updateMany({
          where: { parentTaskId: taskId, deletedAt: null },
          data: { epicId: input.epicId },
        });
      }
      return tx.task.update({
        where: { id: taskId },
        data: {
          title: input.title?.trim(),
          description: input.description,
          status: synced.status,
          listStatusId: synced.listStatusId,
          statusChangedAt: statusAt,
          priority: input.priority,
          dueDate: nextDueDate,
          ...(dueMoveIncrement
            ? { dueDateMoveCount: { increment: dueMoveIncrement } }
            : {}),
          completedAt: synced.completedAt,
          reviewRequired: nextReviewRequired,
          submittedAt: reviewPatch.submittedAt,
          taskTypeId: input.taskTypeId === undefined ? undefined : input.taskTypeId,
          epicId: input.epicId === undefined ? undefined : input.epicId,
          storyPoints: input.storyPoints === undefined ? undefined : input.storyPoints,
          sprintId: input.sprintId === undefined ? undefined : input.sprintId,
          domainEntityId:
            hostLink === undefined
              ? input.domainEntityId === undefined
                ? undefined
                : input.domainEntityId
              : hostLink
                ? hostLink.id
                : null,
          domainEntityType:
            hostLink === undefined
              ? input.domainEntityType === undefined
                ? undefined
                : input.domainEntityType
              : hostLink
                ? hostLink.entityType
                : null,
          domainLabel:
            hostLink === undefined
              ? input.domainLabel === undefined
                ? undefined
                : input.domainLabel
              : hostLink
                ? hostLink.name
                : null,
          hostEntityId: hostLink === undefined ? undefined : hostLink ? hostLink.id : null,
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
    if (reviewPatch.notifyReview) {
      await this.notifyReviewRequested(user.id, updated);
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
      include: { list: true, assignees: true },
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
      const allowedKeys = [
        'status',
        'listStatusId',
        'afterTaskId',
        'position',
        'rankBeforeId',
        'rankAfterId',
      ] as const;
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

    const columns = await this.statuses.resolveForList(targetListId);
    const synced = resolveDualStatus(
      { status: task.status, listStatusId: task.listStatusId, completedAt: task.completedAt },
      columns,
      { status: input.status, listStatusId: input.listStatusId },
    );
    const nextDue =
      input.dueDate === undefined ? (task.dueDate ? task.dueDate.toISOString() : null) : input.dueDate;
    if (input.assigneeIds || input.dueDate !== undefined || synced.changed) {
      const assigneeIds = input.assigneeIds ?? task.assignees?.map((row) => row.userId) ?? [];
      assertDelegationHasDue(user.id, assigneeIds, nextDue, {
        preparing: isBacklogColumn(columns, synced.listStatusId),
      });
    }
    const reviewPatch = this.resolveReviewTransition({
      task,
      columns,
      synced,
      accessLevel: level,
      actorUserId: user.id,
      rejectReason: input.reviewRejectReason,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      let position = task.position;
      if (input.position != null && Number.isFinite(input.position)) {
        position = input.position;
      } else if (input.afterTaskId !== undefined || listChanged) {
        position = await this.resolvePositionInTx(tx, targetListId, taskId, input.afterTaskId ?? null);
      }
      let rank: string | undefined;
      if (input.rankBeforeId != null || input.rankAfterId != null) {
        rank = await this.identity.rankBetweenTasks(
          tx,
          input.rankBeforeId ?? null,
          input.rankAfterId ?? null,
        );
      }
      let key: string | undefined;
      if (listChanged) {
        const targetList = await tx.taskList.findUniqueOrThrow({
          where: { id: targetListId },
          select: { spaceId: true },
        });
        if (targetList.spaceId !== task.list.spaceId) {
          key = await this.identity.nextKey(tx, targetList.spaceId);
          await tx.task.update({ where: { id: taskId }, data: { key } });
          await this.identity.rememberKey(tx, taskId, task.key);
        }
      }
      const statusAt = synced.changed
        ? await this.taskStatus.commit(tx, {
            taskId,
            before: {
              status: task.status,
              listStatusId: task.listStatusId,
              completedAt: task.completedAt,
            },
            after: synced,
            columns,
            actorUserId: user.id,
            reason: StatusReason.MOVE,
            sprintId: task.sprintId,
            storyPoints: task.storyPoints,
          })
        : undefined;
      if (input.assigneeIds) {
        await tx.taskAssignee.deleteMany({ where: { taskId } });
        if (input.assigneeIds.length > 0) {
          await tx.taskAssignee.createMany({
            data: input.assigneeIds.map((assigneeId) => ({ taskId, userId: assigneeId })),
            skipDuplicates: true,
          });
        }
      }
      const nextDueDate =
        input.dueDate === undefined ? undefined : input.dueDate ? new Date(input.dueDate) : null;
      let dueMoveIncrement = 0;
      if (nextDueDate !== undefined && (task.dueDate?.getTime() ?? null) !== (nextDueDate?.getTime() ?? null)) {
        await tx.taskActivity.create({
          data: {
            taskId,
            userId: user.id,
            action: 'DUE_DATE_CHANGED',
            details: {
              from: task.dueDate?.toISOString() ?? null,
              to: nextDueDate?.toISOString() ?? null,
            },
          },
        });
        if (task.dueDate != null) dueMoveIncrement = 1;
      }
      if (input.epicId) {
        await this.assertEpicTarget(tx, {
          taskId,
          listId: targetListId,
          taskTypeId: task.taskTypeId,
          epicId: input.epicId,
        });
      }

      if (reviewPatch.rejectActivity) {
        await tx.taskActivity.create({
          data: {
            taskId,
            userId: user.id,
            action: 'REVIEW_REJECTED',
            details: { reason: reviewPatch.rejectActivity.reason },
          },
        });
      }

      return tx.task.update({
        where: { id: taskId },
        data: {
          listId: targetListId,
          status: synced.status,
          listStatusId: synced.listStatusId,
          completedAt: synced.completedAt,
          submittedAt: reviewPatch.submittedAt,
          position,
          rank,
          key,
          statusChangedAt: statusAt,
          priority: input.priority,
          epicId: input.epicId,
          dueDate: nextDueDate,
          ...(dueMoveIncrement ? { dueDateMoveCount: { increment: dueMoveIncrement } } : {}),
          ...(input.hostEntityId !== undefined
            ? await this.hostPatch(input.hostEntityId)
            : {}),
        },
        include: { assignees: true },
      });
    });

    if (reviewPatch.notifyReview) {
      await this.notifyReviewRequested(user.id, updated);
    }
    return updated;
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
      const synced = resolveDualStatus(task, columns, {
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
        const statusAt = synced.changed
          ? await this.taskStatus.commit(tx, {
              taskId,
              before: {
                status: task.status,
                listStatusId: task.listStatusId,
                completedAt: task.completedAt,
              },
              after: synced,
              columns,
              actorUserId: user.id,
              reason: StatusReason.BULK,
              sprintId: task.sprintId,
              storyPoints: task.storyPoints,
            })
          : undefined;
        return tx.task.update({
          where: { id: taskId },
          data: {
            status: synced.status,
            listStatusId: synced.listStatusId,
            completedAt: synced.completedAt,
            statusChangedAt: statusAt,
            priority: input.priority,
          },
          include: { assignees: true },
        });
      });
      results.push(updated);
    }
    return results;
  }

  private async resolveHostEntityLink(hostEntityId: string | null | undefined) {
    if (hostEntityId == null || hostEntityId === undefined) {
      return null;
    }
    const entity = await this.hostEntities.findActive(hostEntityId);
    return { id: entity.id, entityType: entity.entityType, name: entity.name };
  }

  private resolveReviewTransition(opts: {
    task: {
      reviewRequired: boolean;
      submittedAt: Date | null;
      createdByUserId: string | null;
      listStatusId: string | null;
    };
    columns: Array<{ id: string; name: string }>;
    synced: { status: TaskStatus; listStatusId: string | null; completedAt: Date | null };
    accessLevel: 'manage' | 'assignee' | 'view';
    actorUserId: string;
    rejectReason?: string;
  }): {
    submittedAt: Date | null;
    notifyReview: boolean;
    rejectActivity: { reason: string } | null;
  } {
    const { task, columns, synced, accessLevel, actorUserId, rejectReason } = opts;
    const nextIsReview = isInReviewColumn(columns, synced.listStatusId);
    const nextIsDone = synced.status === TaskStatus.DONE;
    const wasReview = Boolean(task.submittedAt) || isInReviewColumn(columns, task.listStatusId);

    if (accessLevel === 'assignee' && task.reviewRequired && nextIsDone) {
      throw new AppError(
        ErrorCode.TASK_REVIEW_BLOCKS_DONE,
        'Сначала сдайте на проверку; закрыть может постановщик',
        HttpStatus.FORBIDDEN,
      );
    }

    let submittedAt: Date | null = task.submittedAt;
    let notifyReview = false;
    let rejectActivity: { reason: string } | null = null;

    if (nextIsReview) {
      if (!task.submittedAt) {
        submittedAt = new Date();
        notifyReview = true;
      }
    } else if (wasReview || task.submittedAt) {
      submittedAt = null;
      const isCreator = task.createdByUserId === actorUserId;
      if (!nextIsDone && (accessLevel === 'manage' || isCreator)) {
        rejectActivity = {
          reason: rejectReason?.trim() || 'Возвращено с проверки',
        };
      }
    }

    if (nextIsDone) {
      submittedAt = null;
      rejectActivity = null;
    }

    return { submittedAt, notifyReview, rejectActivity };
  }

  private async notifyReviewRequested(
    actorUserId: string,
    task: {
      id: string;
      title: string;
      createdByUserId: string | null;
      submittedAt: Date | null;
    },
  ) {
    if (!task.createdByUserId || !task.submittedAt) return;
    const submittedKey = task.submittedAt.toISOString();
    await this.notifications.notify({
      userIds: [task.createdByUserId],
      actorUserId,
      code: NotificationCode.TASK_REVIEW_REQUESTED,
      title: 'На проверке',
      body: task.title,
      taskId: task.id,
      dedupKey: `review:${task.id}:${submittedKey}`,
    });
  }

  private async hostPatch(hostEntityId: string | null) {
    if (hostEntityId === null) {
      return {
        hostEntityId: null,
        domainEntityId: null,
        domainEntityType: null,
        domainLabel: null,
      };
    }
    const hostLink = await this.resolveHostEntityLink(hostEntityId);
    if (!hostLink) {
      throw AppError.notFound('Сущность не найдена');
    }
    return {
      hostEntityId: hostLink.id,
      domainEntityType: hostLink.entityType,
      domainEntityId: hostLink.id,
      domainLabel: hostLink.name,
    };
  }

  private async replaceLabels(tx: Prisma.TransactionClient, taskId: string, labelIds: string[]) {
    const unique = [...new Set(labelIds)];
    if (unique.length > 0) {
      const found = await tx.label.count({ where: { id: { in: unique } } });
      if (found !== unique.length) {
        throw AppError.badRequest('Метка не найдена');
      }
    }
    await tx.taskLabel.deleteMany({ where: { taskId } });
    if (unique.length > 0) {
      await tx.taskLabel.createMany({
        data: unique.map((labelId) => ({ taskId, labelId })),
        skipDuplicates: true,
      });
    }
  }

  private async assertEpicTarget(
    tx: Prisma.TransactionClient,
    input: { taskId: string | null; listId: string; taskTypeId: string | null; epicId: string | null },
  ) {
    if (!input.epicId) return;
    if (input.taskId && input.epicId === input.taskId) {
      throw new AppError(ErrorCode.EPIC_INVALID, 'Задача не может быть эпиком самой себя', HttpStatus.BAD_REQUEST);
    }
    await this.assertNotNestingEpic(tx, input.taskId, input.taskTypeId, input.epicId);
    const epic = await tx.task.findFirst({
      where: { id: input.epicId, deletedAt: null },
      include: { taskType: true, list: { select: { spaceId: true } } },
    });
    if (!epic || epic.taskType?.key !== EPIC_TYPE_KEY) {
      throw new AppError(ErrorCode.EPIC_INVALID, 'Эпик не найден', HttpStatus.BAD_REQUEST);
    }
    const list = await tx.taskList.findUnique({ where: { id: input.listId }, select: { spaceId: true } });
    if (!list || list.spaceId !== epic.list.spaceId) {
      throw new AppError(ErrorCode.EPIC_INVALID, 'Эпик из другого пространства', HttpStatus.BAD_REQUEST);
    }
  }

  private async assertNotNestingEpic(
    tx: Prisma.TransactionClient,
    taskId: string | null,
    taskTypeId: string | null,
    epicId: string | null,
  ) {
    if (!epicId || !taskTypeId) return;
    const type = await tx.taskType.findUnique({ where: { id: taskTypeId }, select: { key: true } });
    if (type?.key === EPIC_TYPE_KEY) {
      throw new AppError(ErrorCode.EPIC_INVALID, 'Эпик не вкладывается в эпик', HttpStatus.BAD_REQUEST);
    }
    if (taskId) {
      const childEpic = await tx.task.count({
        where: { epicId: taskId, deletedAt: null },
      });
      if (childEpic > 0 && type?.key === EPIC_TYPE_KEY) {
        throw new AppError(ErrorCode.EPIC_INVALID, 'Эпик не вкладывается в эпик', HttpStatus.BAD_REQUEST);
      }
    }
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

  async markStuck(user: AuthUser, taskId: string, reasonRaw: string) {
    const level = await this.taskAccess.resolveLevel(user, taskId);
    if (level === 'view') {
      throw AppError.forbidden();
    }
    const reason = reasonRaw.trim().slice(0, STUCK_REASON_MAX_LENGTH);
    if (!reason) {
      throw AppError.badRequest('Укажите причину блокировки');
    }
    const task = await this.prisma.task.findFirstOrThrow({
      where: { id: taskId, deletedAt: null },
      include: { assignees: true },
    });
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.taskActivity.create({
        data: {
          taskId,
          userId: user.id,
          action: 'TASK_STUCK',
          details: { reason },
        },
      });
      return tx.task.update({
        where: { id: taskId },
        data: {
          isStuck: true,
          stuckAt: now,
          stuckReason: reason,
          stuckByUserId: user.id,
        },
        include: { assignees: true },
      });
    });
    const notifyIds = [
      task.ownerUserId,
      task.createdByUserId,
      ...task.assignees.map((row) => row.userId),
    ].filter((id): id is string => Boolean(id && id !== user.id));
    await this.notifications.notify({
      userIds: notifyIds,
      actorUserId: user.id,
      code: NotificationCode.TASK_STUCK,
      title: 'Задача застряла',
      body: `${updated.title}: ${reason}`,
      taskId,
      dedupKey: `stuck:${taskId}:${now.toISOString().slice(0, 10)}`,
    });
    return updated;
  }

  async clearStuck(user: AuthUser, taskId: string) {
    const level = await this.taskAccess.resolveLevel(user, taskId);
    if (level === 'view') {
      throw AppError.forbidden();
    }
    const task = await this.prisma.task.findFirstOrThrow({
      where: { id: taskId, deletedAt: null },
    });
    if (!task.isStuck) {
      return task;
    }
    if (level === 'assignee') {
      const canClear =
        task.ownerUserId === user.id ||
        task.createdByUserId === user.id ||
        task.stuckByUserId === user.id;
      if (!canClear) {
        throw AppError.forbidden();
      }
    }
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        isStuck: false,
        stuckAt: null,
        stuckReason: null,
        stuckByUserId: null,
      },
      include: { assignees: true },
    });
  }
}

function assertStoryPoints(value: number | null | undefined): void {
  if (value == null) return;
  if (!Number.isFinite(value) || value < 0 || value > STORY_POINTS_MAX) {
    throw AppError.badRequest('Оценка вне диапазона 0..999.9');
  }
}

function samePoints(previous: Prisma.Decimal | null, next: number | null): boolean {
  if (previous == null && next == null) return true;
  if (previous == null || next == null) return false;
  return Number(previous) === next;
}
