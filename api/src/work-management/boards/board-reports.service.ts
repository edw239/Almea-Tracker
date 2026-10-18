import { Injectable } from '@nestjs/common';
import { SprintState, TaskStatus } from '@prisma/client';
import { REPORT_DEFAULT_DAYS, VELOCITY_SPRINTS, CYCLE_ROLLING_WINDOW, DEFAULT_TIMEZONE } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { listBusinessDayKeys } from '../utils/business-days.util';
import { cumulativeFlow, cycleTimes, sprintBurndown, velocity } from '../utils/board-reports.util';
import { normalizeStatusName } from '../utils/task-status.util';
import { BoardAccessService } from './board-access.service';

@Injectable()
export class BoardReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
  ) {}

  async burndown(user: AuthUser, boardId: string, sprintId: string | undefined, metric: 'points' | 'count') {
    const board = await this.load(user, boardId);
    const sprint = await this.sprint(board.id, sprintId);
    if (!sprint.startDate || !sprint.endDate) {
      throw AppError.badRequest('У спринта нет дат');
    }
    const events = await this.prisma.sprintEvent.findMany({
      where: { sprintId: sprint.id },
      orderBy: { createdAt: 'asc' },
    });
    const profile = await this.prisma.user.findUnique({ where: { id: user.id }, select: { timezone: true } });
    const timezone = profile?.timezone || DEFAULT_TIMEZONE;
    const days = listBusinessDayKeys(sprint.startDate, sprint.endDate, timezone);
    const points = sprintBurndown({
      start: sprint.startDate,
      end: sprint.endDate,
      asOf: new Date(),
      metric,
      businessDays: days,
      events: events.map((event) => ({
        type: event.type,
        taskId: event.taskId,
        storyPoints: event.storyPoints == null ? null : Number(event.storyPoints),
        createdAt: event.createdAt,
      })),
    });
    const approximate = await this.hasSynthetic(events.map((event) => event.taskId).filter((id): id is string => Boolean(id)));
    return { sprint: { id: sprint.id, name: sprint.name }, metric, points, approximate };
  }

  async sprintReport(user: AuthUser, boardId: string, sprintId: string | undefined) {
    const board = await this.load(user, boardId);
    const sprint = await this.sprint(board.id, sprintId);
    const events = await this.prisma.sprintEvent.findMany({ where: { sprintId: sprint.id } });
    const sum = (type: string) =>
      events
        .filter((event) => event.type === type)
        .reduce((total, event) => total + (event.storyPoints == null ? 0 : Number(event.storyPoints)), 0);
    const count = (type: string) => events.filter((event) => event.type === type).length;
    return {
      sprint: {
        id: sprint.id,
        name: sprint.name,
        goal: sprint.goal,
        state: sprint.state,
        startDate: sprint.startDate,
        endDate: sprint.endDate,
      },
      commitment: sum('COMMITTED'),
      completed: sum('CLOSED_DONE'),
      incomplete: sum('CLOSED_INCOMPLETE'),
      added: count('ADDED'),
      removed: count('REMOVED'),
      approximate: await this.hasSynthetic(events.map((event) => event.taskId).filter((id): id is string => Boolean(id))),
    };
  }

  async velocityReport(user: AuthUser, boardId: string) {
    const board = await this.load(user, boardId);
    const sprints = await this.prisma.sprint.findMany({
      where: { boardId: board.id, state: SprintState.CLOSED },
      orderBy: { closedAt: 'desc' },
      take: VELOCITY_SPRINTS,
    });
    const ordered = [...sprints].reverse();
    const events = await this.prisma.sprintEvent.findMany({
      where: { sprintId: { in: ordered.map((sprint) => sprint.id) } },
    });
    return {
      sprints: velocity({
        sprints: ordered.map((sprint) => ({
          id: sprint.id,
          name: sprint.name,
          events: events
            .filter((event) => event.sprintId === sprint.id)
            .map((event) => ({
              type: event.type,
              taskId: event.taskId,
              storyPoints: event.storyPoints == null ? null : Number(event.storyPoints),
              createdAt: event.createdAt,
            })),
        })),
      }),
    };
  }

  async cfd(user: AuthUser, boardId: string, days = REPORT_DEFAULT_DAYS) {
    const board = await this.load(user, boardId);
    const listIds = await this.access.listIdsFor(board.sources);
    const since = new Date(Date.now() - days * 86_400_000);
    const columns = [...board.columns].sort((a, b) => a.position - b.position);
    const transitions = await this.prisma.taskStatusTransition.findMany({
      where: { task: { listId: { in: listIds }, deletedAt: null }, createdAt: { gte: since } },
      include: { task: { select: { listStatus: { select: { name: true } } } } },
    });
    const profile = await this.prisma.user.findUnique({ where: { id: user.id }, select: { timezone: true } });
    const timezone = profile?.timezone || DEFAULT_TIMEZONE;
    const dayKeys = listBusinessDayKeys(since, new Date(), timezone);
    const mapped = transitions.map((row) => {
      const name = normalizeStatusName(row.task.listStatus?.name ?? row.toStatus);
      const column = columns.find((item) => item.statusNames.includes(name));
      return {
        taskId: row.taskId,
        toCategory: row.toCategory,
        toColumn: column?.name ?? '',
        createdAt: row.createdAt,
        reason: row.reason,
      };
    });
    const flow = cumulativeFlow({
      days: dayKeys,
      columns: columns.map((column) => column.name),
      transitions: mapped,
    });
    return {
      ...flow,
      approximate: flow.approximate || mapped.some((row) => row.reason === 'synthetic'),
    };
  }

  async cycle(user: AuthUser, boardId: string, days = REPORT_DEFAULT_DAYS) {
    const board = await this.load(user, boardId);
    const listIds = await this.access.listIdsFor(board.sources);
    const since = new Date(Date.now() - days * 86_400_000);
    const transitions = await this.prisma.taskStatusTransition.findMany({
      where: {
        task: { listId: { in: listIds }, deletedAt: null },
        toCategory: { in: [TaskStatus.IN_PROGRESS, TaskStatus.DONE] },
        createdAt: { gte: since },
      },
    });
    return cycleTimes({
      window: CYCLE_ROLLING_WINDOW,
      transitions: transitions.map((row) => ({
        taskId: row.taskId,
        toCategory: row.toCategory,
        createdAt: row.createdAt,
        reason: row.reason,
      })),
    });
  }

  private async load(user: AuthUser, boardId: string) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, isArchived: false },
      include: { sources: true, columns: true },
    });
    if (!board) throw AppError.notFound();
    await this.access.assertCanView(user, board.sources);
    return board;
  }

  private async sprint(boardId: string, sprintId?: string) {
    const sprint = sprintId
      ? await this.prisma.sprint.findFirst({ where: { id: sprintId, boardId } })
      : await this.prisma.sprint.findFirst({
          where: { boardId, state: SprintState.ACTIVE },
          orderBy: { startedAt: 'desc' },
        });
    if (!sprint) throw AppError.notFound('Спринт не найден');
    return sprint;
  }

  private async hasSynthetic(taskIds: string[]) {
    if (taskIds.length === 0) return false;
    const hit = await this.prisma.taskStatusTransition.findFirst({
      where: { taskId: { in: taskIds }, reason: 'synthetic' },
      select: { id: true },
    });
    return Boolean(hit);
  }
}
