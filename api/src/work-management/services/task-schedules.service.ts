import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ScheduleFrequency, TaskPriority, TaskSpaceMemberRole, TaskStatus } from '@prisma/client';
import {
  SCHEDULE_AT_MINUTE_MAX,
  SCHEDULE_AT_MINUTE_MIN,
  SCHEDULE_MONTHDAY_MAX,
  SCHEDULE_MONTHDAY_MIN,
  SCHEDULE_RUN_BATCH,
  SCHEDULE_TITLE_MAX_LENGTH,
  SCHEDULE_WEEKDAY_MAX,
  SCHEDULE_WEEKDAY_MIN,
  TITLE_MAX_LENGTH,
} from '../../common/constants';
import { AppError } from '../../common/errors';
import { isValidIanaTimezone } from '../../identity/utils/timezone.util';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { computeNextRunAt, schedulePeriodKey } from '../utils/schedule-timing.util';
import { nextPosition } from '../utils/task-position.util';
import { TaskListStatusesService } from './task-list-statuses.service';
import { TaskTemplatesService } from './task-templates.service';
import { TaskIdentityService } from './task-identity.service';
import { TaskStatusService } from './task-status.service';
import { StatusReason } from '../utils/task-status.util';

export type CreateScheduleInput = {
  title: string;
  frequency: ScheduleFrequency;
  byWeekday?: number;
  byMonthday?: number;
  atMinute: number;
  timezone: string;
  templateId?: string;
  assigneeUserId?: string;
  dueInDays?: number;
};

export type UpdateScheduleInput = {
  title?: string;
  isActive?: boolean;
  assigneeUserId?: string | null;
  dueInDays?: number | null;
  atMinute?: number;
  timezone?: string;
  byWeekday?: number | null;
  byMonthday?: number | null;
};

@Injectable()
export class TaskSchedulesService {
  private readonly logger = new Logger(TaskSchedulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
    private readonly templates: TaskTemplatesService,
    private readonly identity: TaskIdentityService,
    private readonly taskStatus: TaskStatusService,
  ) {}

  async listForList(user: AuthUser, listId: string) {
    const list = await this.requireList(listId);
    await this.spaces.getVisibleSpace(user, list.spaceId);
    return this.prisma.taskSchedule.findMany({
      where: { listId },
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
    });
  }

  async create(user: AuthUser, listId: string, input: CreateScheduleInput) {
    const list = await this.requireList(listId);
    await this.spaces.assertCanManageSpace(user, list.spaceId);
    this.validateTiming(input);

    if (input.templateId) {
      const template = await this.prisma.taskTemplate.findFirst({
        where: { id: input.templateId, isActive: true },
      });
      if (!template) throw AppError.notFound();
      if (template.listId && template.listId !== list.id) {
        throw AppError.badRequest('Шаблон привязан к другому списку');
      }
      if (template.spaceId && template.spaceId !== list.spaceId) {
        throw AppError.badRequest('Шаблон привязан к другому space');
      }
    }

    const assigneeUserId = input.assigneeUserId ?? user.id;
    await this.requireActiveUser(assigneeUserId);

    const title = input.title.trim().slice(0, SCHEDULE_TITLE_MAX_LENGTH);
    const now = new Date();
    const nextRunAt = computeNextRunAt(
      now,
      {
        frequency: input.frequency,
        byWeekday: input.byWeekday,
        byMonthday: input.byMonthday,
        atMinute: input.atMinute,
        timezone: input.timezone,
      },
      { inclusive: true },
    );

    return this.prisma.taskSchedule.create({
      data: {
        listId,
        templateId: input.templateId ?? null,
        title,
        frequency: input.frequency,
        byWeekday: input.frequency === ScheduleFrequency.WEEKLY ? input.byWeekday! : null,
        byMonthday: input.frequency === ScheduleFrequency.MONTHLY ? input.byMonthday! : null,
        atMinute: input.atMinute,
        timezone: input.timezone,
        assigneeUserId,
        dueInDays: input.dueInDays ?? null,
        nextRunAt,
      },
    });
  }

  async update(user: AuthUser, scheduleId: string, input: UpdateScheduleInput) {
    const schedule = await this.prisma.taskSchedule.findUnique({ where: { id: scheduleId } });
    if (!schedule) throw AppError.notFound();
    const list = await this.requireList(schedule.listId);
    await this.spaces.assertCanManageSpace(user, list.spaceId);

    if (input.assigneeUserId) {
      await this.requireActiveUser(input.assigneeUserId);
    }

    const frequency = schedule.frequency;
    const atMinute = input.atMinute ?? schedule.atMinute;
    const timezone = input.timezone ?? schedule.timezone;
    const byWeekday =
      input.byWeekday !== undefined ? input.byWeekday : schedule.byWeekday;
    const byMonthday =
      input.byMonthday !== undefined ? input.byMonthday : schedule.byMonthday;

    this.validateTiming({
      frequency,
      byWeekday: byWeekday ?? undefined,
      byMonthday: byMonthday ?? undefined,
      atMinute,
      timezone,
    });

    const timingChanged =
      input.atMinute !== undefined ||
      input.timezone !== undefined ||
      input.byWeekday !== undefined ||
      input.byMonthday !== undefined;

    const nextRunAt = timingChanged
      ? computeNextRunAt(
          new Date(),
          {
            frequency,
            byWeekday,
            byMonthday,
            atMinute,
            timezone,
          },
          { inclusive: true },
        )
      : undefined;

    return this.prisma.taskSchedule.update({
      where: { id: scheduleId },
      data: {
        title: input.title?.trim().slice(0, SCHEDULE_TITLE_MAX_LENGTH),
        isActive: input.isActive,
        assigneeUserId: input.assigneeUserId === undefined ? undefined : input.assigneeUserId,
        dueInDays: input.dueInDays === undefined ? undefined : input.dueInDays,
        atMinute: input.atMinute,
        timezone: input.timezone,
        byWeekday: frequency === ScheduleFrequency.WEEKLY ? byWeekday : null,
        byMonthday: frequency === ScheduleFrequency.MONTHLY ? byMonthday : null,
        nextRunAt,
      },
    });
  }

  /**
   * Process due schedules. Idempotent via (schedule_id, period_key) PK.
   * Safe to call twice for the same period after process restart.
   */
  async runDueSchedules(now = new Date()): Promise<{ claimed: number; createdTasks: number }> {
    const due = await this.prisma.taskSchedule.findMany({
      where: { isActive: true, nextRunAt: { lte: now } },
      orderBy: { nextRunAt: 'asc' },
      take: SCHEDULE_RUN_BATCH,
    });

    let claimed = 0;
    let createdTasks = 0;

    for (const schedule of due) {
      const periodKey = schedulePeriodKey(schedule.nextRunAt, schedule.frequency, schedule.timezone);
      let claimedThis = false;
      try {
        await this.prisma.taskScheduleRun.create({
          data: { scheduleId: schedule.id, periodKey },
        });
        claimedThis = true;
        claimed += 1;
      } catch (error) {
        if (!this.isUniqueViolation(error)) {
          this.logger.error(`schedule run claim failed schedule=${schedule.id}`, error as Error);
          throw error;
        }
      }

      if (claimedThis) {
        try {
          const taskId = await this.materializeSchedule(schedule, now);
          if (taskId) {
            createdTasks += 1;
            await this.prisma.taskScheduleRun.update({
              where: { scheduleId_periodKey: { scheduleId: schedule.id, periodKey } },
              data: { taskId },
            });
          }
        } catch (error) {
          this.logger.error(`schedule materialize failed schedule=${schedule.id}`, error as Error);
        }
      }

      const nextRunAt = computeNextRunAt(
        now,
        {
          frequency: schedule.frequency,
          byWeekday: schedule.byWeekday,
          byMonthday: schedule.byMonthday,
          atMinute: schedule.atMinute,
          timezone: schedule.timezone,
        },
        { inclusive: false },
      );

      await this.prisma.taskSchedule.update({
        where: { id: schedule.id },
        data: {
          lastRunAt: claimedThis ? now : schedule.lastRunAt,
          nextRunAt,
        },
      });
    }

    return { claimed, createdTasks };
  }

  private async materializeSchedule(
    schedule: {
      id: string;
      listId: string;
      templateId: string | null;
      title: string;
      assigneeUserId: string | null;
      dueInDays: number | null;
    },
    now: Date,
  ): Promise<string | null> {
    const list = await this.prisma.taskList.findFirst({
      where: { id: schedule.listId, isArchived: false },
    });
    if (!list) {
      return null;
    }

    let assigneeUserId = schedule.assigneeUserId;
    if (assigneeUserId) {
      const assignee = await this.prisma.user.findFirst({
        where: { id: assigneeUserId, isActive: true },
        select: { id: true },
      });
      if (!assignee) {
        assigneeUserId = null;
      }
    }
    if (!assigneeUserId) {
      const owner = await this.prisma.taskSpaceMember.findFirst({
        where: { spaceId: list.spaceId, role: TaskSpaceMemberRole.OWNER },
        select: { userId: true },
      });
      assigneeUserId = owner?.userId ?? null;
    }
    if (!assigneeUserId) {
      this.logger.warn(`schedule ${schedule.id}: no assignee, skip`);
      return null;
    }

    const dueDate =
      schedule.dueInDays != null
        ? new Date(now.getTime() + schedule.dueInDays * 86_400_000)
        : null;

    if (schedule.templateId) {
      const created = await this.templates.expandTemplateIntoList({
        listId: schedule.listId,
        templateId: schedule.templateId,
        actorUserId: assigneeUserId,
        assigneeUserId,
        dueDate,
      });
      return created[0]?.id ?? null;
    }

    const columns = await this.statuses.resolveForList(schedule.listId);
    const open = this.statuses.defaultForCategory(columns, TaskStatus.OPEN);
    const last = await this.prisma.task.findFirst({
      where: { listId: schedule.listId, deletedAt: null, parentTaskId: null },
      orderBy: { position: 'desc' },
    });
    const position = nextPosition(last?.position ?? 0);
    const task = await this.prisma.$transaction(async (tx) => {
      const key = await this.identity.nextKey(tx, list.spaceId);
      const rank = await this.identity.nextRank(tx);
      const at = new Date();
      const created = await tx.task.create({
        data: {
          listId: schedule.listId,
          ownerUserId: assigneeUserId,
          createdByUserId: assigneeUserId,
          title: schedule.title.slice(0, TITLE_MAX_LENGTH),
          status: TaskStatus.OPEN,
          listStatusId: open?.id ?? null,
          priority: TaskPriority.MEDIUM,
          dueDate,
          position,
          key,
          rank,
          statusChangedAt: at,
          assignees: { create: { userId: assigneeUserId } },
        },
      });
      await this.taskStatus.commit(tx, {
        taskId: created.id,
        before: null,
        after: { status: TaskStatus.OPEN, listStatusId: open?.id ?? null, completedAt: null },
        columns,
        actorUserId: assigneeUserId,
        reason: StatusReason.CREATE,
        at,
      });
      return created;
    });
    return task.id;
  }

  private validateTiming(input: {
    frequency: ScheduleFrequency;
    byWeekday?: number | null;
    byMonthday?: number | null;
    atMinute: number;
    timezone: string;
  }) {
    if (!isValidIanaTimezone(input.timezone)) {
      throw AppError.badRequest('Некорректный timezone');
    }
    if (
      input.atMinute < SCHEDULE_AT_MINUTE_MIN ||
      input.atMinute > SCHEDULE_AT_MINUTE_MAX
    ) {
      throw AppError.badRequest('atMinute вне диапазона 0..1439');
    }
    if (input.frequency === ScheduleFrequency.WEEKLY) {
      if (
        input.byWeekday == null ||
        input.byWeekday < SCHEDULE_WEEKDAY_MIN ||
        input.byWeekday > SCHEDULE_WEEKDAY_MAX
      ) {
        throw AppError.badRequest('WEEKLY требует byWeekday 1..7');
      }
    }
    if (input.frequency === ScheduleFrequency.MONTHLY) {
      if (
        input.byMonthday == null ||
        input.byMonthday < SCHEDULE_MONTHDAY_MIN ||
        input.byMonthday > SCHEDULE_MONTHDAY_MAX
      ) {
        throw AppError.badRequest('MONTHLY требует byMonthday 1..28');
      }
    }
  }

  private async requireList(listId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) throw AppError.notFound();
    return list;
  }

  private async requireActiveUser(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      select: { id: true },
    });
    if (!user) throw AppError.badRequest('Исполнитель не найден или неактивен');
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
    );
  }
}
