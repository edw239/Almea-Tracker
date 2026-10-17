import { Injectable } from '@nestjs/common';
import { Prisma, TaskRelationType, TaskSpaceMemberRole, TaskStatus, UserRole } from '@prisma/client';
import { RESCHEDULED_MIN_MOVES, DEFAULT_TIMEZONE } from '../../common/constants';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { summaryDayBounds } from '../../identity/utils/zoned-day.util';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { businessDaysAgo } from '../utils/business-days.util';

const OVERVIEW_BLOCK_LIMIT = 50;
const UNASSIGNED_AGE_MS = 24 * 60 * 60 * 1000;
const STALE_BUSINESS_DAYS = 3;

const TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  listId: true,
  dueDate: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  reviewRequired: true,
  assignees: { select: { userId: true } },
  list: { select: { id: true, name: true, spaceId: true } },
} as const;

export type OverviewTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  listId: string;
  listName: string;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  assigneeIds: string[];
};

@Injectable()
export class OverviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceAccess: TaskSpaceAccessService,
  ) {}

  async getOverview(user: AuthUser, now = new Date()) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    const timezone = profile?.timezone || DEFAULT_TIMEZONE;
    const { todayStart } = summaryDayBounds(now, timezone);
    const staleBefore = businessDaysAgo(now, STALE_BUSINESS_DAYS, timezone);
    const unassignedBefore = new Date(now.getTime() - UNASSIGNED_AGE_MS);
    const visibility = await this.buildVisibilityWhere(user);

    const baseOpen: Prisma.TaskWhereInput = {
      deletedAt: null,
      parentTaskId: null,
      ...visibility,
    };

    const activeBlocker: Prisma.TaskWhereInput = {
      relationsTo: {
        some: {
          relationType: TaskRelationType.BLOCKS,
          fromTask: {
            deletedAt: null,
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          },
        },
      },
    };

    const [unassigned, stale, blocked, awaitingReview, overdue, rescheduled] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          assignees: { none: {} },
          createdAt: { lt: unassignedBefore },
        },
        orderBy: { createdAt: 'asc' },
        take: OVERVIEW_BLOCK_LIMIT,
        select: TASK_SELECT,
      }),
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          status: { in: [TaskStatus.OPEN, TaskStatus.IN_PROGRESS] },
          updatedAt: { lt: staleBefore },
          NOT: activeBlocker,
        },
        orderBy: { updatedAt: 'asc' },
        take: OVERVIEW_BLOCK_LIMIT,
        select: TASK_SELECT,
      }),
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          ...activeBlocker,
        },
        orderBy: { updatedAt: 'asc' },
        take: OVERVIEW_BLOCK_LIMIT,
        select: TASK_SELECT,
      }),
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          reviewRequired: true,
          submittedAt: { not: null },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        },
        orderBy: { submittedAt: 'asc' },
        take: OVERVIEW_BLOCK_LIMIT,
        select: TASK_SELECT,
      }),
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          dueDate: { lt: todayStart },
          assignees: { some: {} },
        },
        orderBy: { dueDate: 'asc' },
        take: OVERVIEW_BLOCK_LIMIT * 3,
        select: TASK_SELECT,
      }),
      this.prisma.task.findMany({
        where: {
          ...baseOpen,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
          dueDateMoveCount: { gte: RESCHEDULED_MIN_MOVES },
        },
        orderBy: [{ dueDateMoveCount: 'desc' }, { updatedAt: 'desc' }],
        take: OVERVIEW_BLOCK_LIMIT,
        select: { ...TASK_SELECT, dueDateMoveCount: true },
      }),
    ]);

    const overdueMapped = overdue.map((row) => this.mapTask(row));
    const byUser = new Map<string, OverviewTaskRow[]>();
    for (const task of overdueMapped) {
      for (const userId of task.assigneeIds) {
        const bucket = byUser.get(userId) ?? [];
        bucket.push(task);
        byUser.set(userId, bucket);
      }
    }
    const userIds = [...byUser.keys()];
    const users =
      userIds.length === 0
        ? []
        : await this.prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true },
          });
    const nameById = new Map(users.map((row) => [row.id, row.name]));
    const overdueByUser = [...byUser.entries()]
      .map(([userId, tasks]) => ({
        userId,
        userName: nameById.get(userId) ?? userId,
        tasks: tasks.slice(0, OVERVIEW_BLOCK_LIMIT),
        count: tasks.length,
      }))
      .sort((a, b) => b.count - a.count || a.userName.localeCompare(b.userName, 'ru'));

    return {
      timezone,
      asOf: now.toISOString(),
      scope: visibility === undefined || Object.keys(visibility).length === 0 ? 'company' : 'visible',
      unassigned: unassigned.map((row) => this.mapTask(row)),
      stale: stale.map((row) => this.mapTask(row)),
      blocked: blocked.map((row) => this.mapTask(row)),
      awaitingReview: awaitingReview.map((row) => this.mapTask(row)),
      rescheduled: rescheduled.map((row) => ({
        ...this.mapTask(row),
        dueDateMoveCount: row.dueDateMoveCount,
      })),
      overdueByUser,
    };
  }

  /**
   * Company-wide for GLOBAL_ADMIN or OWNER of a non-system space;
   * otherwise only spaces the actor can see (memberships + system).
   */
  private async buildVisibilityWhere(user: AuthUser): Promise<Prisma.TaskWhereInput> {
    if (user.role === UserRole.GLOBAL_ADMIN) {
      return {};
    }
    const owned = await this.prisma.taskSpaceMember.findFirst({
      where: {
        userId: user.id,
        role: TaskSpaceMemberRole.OWNER,
        space: { isSystem: false, isArchived: false },
      },
      select: { spaceId: true },
    });
    if (owned) {
      return {};
    }
    const scope = await this.spaceAccess.listVisibleSpaceIds(user);
    if (scope === 'all') {
      return {};
    }
    return {
      list: {
        space: {
          OR: [{ isSystem: true }, { id: { in: scope } }],
        },
      },
    };
  }

  private mapTask(row: {
    id: string;
    title: string;
    status: TaskStatus;
    listId: string;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
    submittedAt: Date | null;
    assignees: Array<{ userId: string }>;
    list: { id: string; name: string; spaceId: string };
  }): OverviewTaskRow {
    return {
      id: row.id,
      title: row.title,
      status: row.status,
      listId: row.listId,
      listName: row.list.name,
      dueDate: row.dueDate ? row.dueDate.toISOString() : null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
      assigneeIds: row.assignees.map((item) => item.userId),
    };
  }
}
