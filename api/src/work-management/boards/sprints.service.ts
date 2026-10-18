import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import {
  BoardType,
  Prisma,
  SprintEventType,
  SprintState,
  TaskStatus,
} from '@prisma/client';
import { SPRINT_DEFAULT_LENGTH_DAYS, SPRINT_NAME_MAX_LENGTH } from '../../common/constants';
import { AppError, ErrorCode } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { isDelegationWithoutDue } from '../utils/task-delegation.util';
import { isBacklogColumn, normalizeStatusName, StatusReason } from '../utils/task-status.util';
import { TaskListStatusesService } from '../services/task-list-statuses.service';
import { TaskStatusService } from '../services/task-status.service';
import { BoardAccessService } from './board-access.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class SprintsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly statuses: TaskListStatusesService,
    private readonly taskStatus: TaskStatusService,
  ) {}

  async list(user: AuthUser, boardId: string) {
    const board = await this.loadBoard(user, boardId);
    return this.prisma.sprint.findMany({
      where: { boardId: board.id },
      orderBy: { position: 'asc' },
    });
  }

  async create(
    user: AuthUser,
    boardId: string,
    input: { name: string; goal?: string; startDate?: string; endDate?: string },
  ) {
    const board = await this.loadBoard(user, boardId, true);
    if (board.type !== BoardType.SCRUM) {
      throw AppError.badRequest('Спринты есть только у Scrum-доски');
    }
    const name = input.name.trim();
    if (!name || name.length > SPRINT_NAME_MAX_LENGTH) {
      throw AppError.badRequest('Название спринта: 1–120 символов');
    }
    const last = await this.prisma.sprint.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
    });
    const start = input.startDate ? new Date(input.startDate) : null;
    const end = input.endDate
      ? new Date(input.endDate)
      : start
        ? new Date(start.getTime() + SPRINT_DEFAULT_LENGTH_DAYS * 86_400_000)
        : null;
    return this.prisma.sprint.create({
      data: {
        boardId,
        name,
        goal: input.goal?.trim() || null,
        startDate: start,
        endDate: end,
        position: (last?.position ?? 0) + 1000,
      },
    });
  }

  async update(
    user: AuthUser,
    sprintId: string,
    input: { name?: string; goal?: string | null; startDate?: string | null; endDate?: string | null },
  ) {
    const sprint = await this.requireSprint(user, sprintId, true);
    if (sprint.state === SprintState.CLOSED) {
      throw AppError.badRequest('Закрытый спринт не редактируется');
    }
    return this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        name: input.name?.trim(),
        goal: input.goal === undefined ? undefined : input.goal?.trim() || null,
        startDate: input.startDate === undefined ? undefined : input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate === undefined ? undefined : input.endDate ? new Date(input.endDate) : null,
      },
    });
  }

  async start(user: AuthUser, sprintId: string, confirmMissingDue: boolean) {
    const sprint = await this.requireSprint(user, sprintId, true);
    if (sprint.board.type !== BoardType.SCRUM) {
      throw AppError.badRequest('Спринты есть только у Scrum-доски');
    }
    if (sprint.state !== SprintState.FUTURE) {
      throw AppError.badRequest('Стартовать можно только будущий спринт');
    }
    const active = await this.prisma.sprint.findFirst({
      where: { boardId: sprint.boardId, state: SprintState.ACTIVE },
    });
    if (active) {
      throw new AppError(
        ErrorCode.SPRINT_ALREADY_ACTIVE,
        'На доске уже есть активный спринт',
        HttpStatus.CONFLICT,
      );
    }
    const tasks = await this.prisma.task.findMany({
      where: { sprintId, deletedAt: null, parentTaskId: null },
      include: { assignees: true },
    });
    const missing = tasks.filter((task) =>
      isDelegationWithoutDue(
        task.createdByUserId ?? user.id,
        task.assignees.map((row) => row.userId),
        task.dueDate ? task.dueDate.toISOString() : null,
      ),
    );
    if (missing.length > 0 && !confirmMissingDue) {
      throw new AppError(
        ErrorCode.SPRINT_START_NEEDS_DUE,
        'У поручений в спринте нет срока',
        HttpStatus.BAD_REQUEST,
        {
          tasks: missing.map((task) => ({ id: task.id, key: task.key, title: task.title })),
        },
      );
    }
    const start = sprint.startDate ?? new Date();
    const end =
      sprint.endDate ?? new Date(start.getTime() + SPRINT_DEFAULT_LENGTH_DAYS * 86_400_000);
    const firstColumn = [...sprint.board.columns].sort((a, b) => a.position - b.position)[0];
    await this.prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        if (missing.some((row) => row.id === task.id)) {
          await tx.task.update({ where: { id: task.id }, data: { dueDate: end } });
        }
        const columns = await this.statuses.resolveForList(task.listId);
        if (isBacklogColumn(columns, task.listStatusId) && firstColumn) {
          const match = columns.find(
            (column) =>
              !column.isBacklog &&
              firstColumn.statusNames.includes(normalizeStatusName(column.name)),
          );
          if (match) {
            const at = new Date();
            await this.taskStatus.commit(tx, {
              taskId: task.id,
              before: task,
              after: {
                status: match.category,
                listStatusId: match.id,
                completedAt: match.category === TaskStatus.DONE ? at : null,
              },
              columns,
              actorUserId: user.id,
              reason: StatusReason.SPRINT_START,
              sprintId: task.sprintId,
              storyPoints: task.storyPoints,
            });
            await tx.task.update({
              where: { id: task.id },
              data: {
                status: match.category,
                listStatusId: match.id,
                completedAt: match.category === TaskStatus.DONE ? at : null,
                statusChangedAt: at,
              },
            });
          }
        }
        await tx.sprintEvent.create({
          data: {
            sprintId,
            taskId: task.id,
            actorUserId: user.id,
            type: SprintEventType.COMMITTED,
            storyPoints: task.storyPoints,
          },
        });
      }
      await tx.sprint.update({
        where: { id: sprintId },
        data: { state: SprintState.ACTIVE, startedAt: new Date(), startDate: start, endDate: end },
      });
    });
    return this.prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  }

  async complete(
    user: AuthUser,
    sprintId: string,
    input: {
      unfinishedTo: 'backlog' | 'sprint';
      sprintId?: string;
      createSprint?: { name: string; startDate?: string; endDate?: string; goal?: string };
    },
  ) {
    const sprint = await this.requireSprint(user, sprintId, true);
    if (sprint.state !== SprintState.ACTIVE) {
      throw AppError.badRequest('Завершить можно только активный спринт');
    }
    const tasks = await this.prisma.task.findMany({
      where: { sprintId, deletedAt: null },
      include: { assignees: true },
    });
    const unfinished = tasks.filter(
      (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED,
    );
    let targetId: string | null = null;
    let targetEnd: Date | null = null;
    if (unfinished.length > 0 && input.unfinishedTo === 'sprint') {
      if (input.createSprint) {
        const created = await this.create(user, sprint.boardId, input.createSprint);
        targetId = created.id;
        targetEnd = created.endDate;
      } else if (input.sprintId) {
        const target = await this.prisma.sprint.findFirst({
          where: { id: input.sprintId, boardId: sprint.boardId, state: SprintState.FUTURE },
        });
        if (!target) throw AppError.notFound('Будущий спринт не найден');
        targetId = target.id;
        targetEnd = target.endDate;
      } else {
        throw AppError.badRequest('Укажите спринт для незавершённых задач');
      }
    }
    const sprintEndKey = sprint.endDate ? sprint.endDate.toISOString().slice(0, 10) : null;
    await this.prisma.$transaction(async (tx) => {
      for (const task of tasks) {
        const done = task.status === TaskStatus.DONE;
        await tx.sprintEvent.create({
          data: {
            sprintId,
            taskId: task.id,
            actorUserId: user.id,
            type: done ? SprintEventType.CLOSED_DONE : SprintEventType.CLOSED_INCOMPLETE,
            storyPoints: task.storyPoints,
          },
        });
      }
      for (const task of unfinished) {
        const dueKey = task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null;
        const shiftDue = Boolean(sprintEndKey && dueKey === sprintEndKey && targetEnd);
        if (input.unfinishedTo === 'backlog' || !targetId) {
          const columns = await this.statuses.ensureBacklogStatus(task.listId);
          const backlog = columns.find((column) => column.isBacklog);
          const statusAt =
            backlog && task.listStatusId !== backlog.id
              ? await this.taskStatus.commit(tx, {
                  taskId: task.id,
                  before: task,
                  after: {
                    status: backlog.category,
                    listStatusId: backlog.id,
                    completedAt: null,
                  },
                  columns,
                  actorUserId: user.id,
                  reason: StatusReason.MOVE,
                })
              : undefined;
          await tx.task.update({
            where: { id: task.id },
            data: {
              sprintId: null,
              ...(backlog
                ? { listStatusId: backlog.id, status: backlog.category, completedAt: null }
                : {}),
              ...(statusAt ? { statusChangedAt: statusAt } : {}),
            },
          });
        } else {
          await tx.task.update({
            where: { id: task.id },
            data: {
              sprintId: targetId,
              ...(shiftDue ? { dueDate: targetEnd, dueDateMoveCount: { increment: 1 } } : {}),
            },
          });
          if (shiftDue) {
            await tx.taskActivity.create({
              data: {
                taskId: task.id,
                userId: user.id,
                action: 'DUE_DATE_CHANGED',
                details: {
                  from: task.dueDate?.toISOString() ?? null,
                  to: targetEnd?.toISOString() ?? null,
                  reason: 'sprint_complete',
                },
              },
            });
          }
          await tx.sprintEvent.create({
            data: {
              sprintId: targetId,
              taskId: task.id,
              actorUserId: user.id,
              type: SprintEventType.ADDED,
              storyPoints: task.storyPoints,
            },
          });
        }
      }
      await tx.sprint.update({
        where: { id: sprintId },
        data: { state: SprintState.CLOSED, closedAt: new Date() },
      });
    });
    return this.prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  }

  async noteMembership(
    tx: Tx,
    actorUserId: string,
    task: { id: string; sprintId: string | null; storyPoints: Prisma.Decimal | null },
    nextSprintId: string | null,
  ) {
    if (task.sprintId === nextSprintId) return;
    if (task.sprintId) {
      const previous = await tx.sprint.findUnique({
        where: { id: task.sprintId },
        select: { state: true },
      });
      if (previous?.state === SprintState.ACTIVE) {
        await tx.sprintEvent.create({
          data: {
            sprintId: task.sprintId,
            taskId: task.id,
            actorUserId,
            type: SprintEventType.REMOVED,
            storyPoints: task.storyPoints,
          },
        });
      }
    }
    if (!nextSprintId) return;
    const next = await tx.sprint.findUnique({ where: { id: nextSprintId }, select: { state: true } });
    if (!next) throw AppError.notFound('Спринт не найден');
    if (next.state === SprintState.ACTIVE) {
      await tx.sprintEvent.create({
        data: {
          sprintId: nextSprintId,
          taskId: task.id,
          actorUserId,
          type: SprintEventType.ADDED,
          storyPoints: task.storyPoints,
        },
      });
    }
  }

  async noteEstimate(
    tx: Tx,
    actorUserId: string,
    sprintId: string,
    taskId: string,
    next: number | null,
    previous: Prisma.Decimal | null,
  ) {
    const sprint = await tx.sprint.findFirst({
      where: { id: sprintId, state: SprintState.ACTIVE },
      select: { id: true },
    });
    if (!sprint) return;
    await tx.sprintEvent.create({
      data: {
        sprintId,
        taskId,
        actorUserId,
        type: SprintEventType.ESTIMATE_CHANGED,
        storyPoints: next,
        details: { from: previous === null ? null : Number(previous) },
      },
    });
  }

  private async loadBoard(user: AuthUser, boardId: string, configure = false) {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, isArchived: false },
      include: { sources: true, columns: true },
    });
    if (!board) throw AppError.notFound();
    await this.access.assertCanView(user, board.sources);
    if (configure) await this.access.assertCanConfigure(user, board);
    return board;
  }

  private async requireSprint(user: AuthUser, sprintId: string, configure = false) {
    const sprint = await this.prisma.sprint.findUnique({
      where: { id: sprintId },
      include: { board: { include: { sources: true, columns: true } } },
    });
    if (!sprint || sprint.board.isArchived) throw AppError.notFound();
    await this.access.assertCanView(user, sprint.board.sources);
    if (configure) await this.access.assertCanConfigure(user, sprint.board);
    return sprint;
  }
}
