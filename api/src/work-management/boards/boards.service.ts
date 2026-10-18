import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import {
  BoardCardColor,
  BoardSwimlane,
  BoardType,
  Prisma,
  SprintState,
  TaskPriority,
  TaskSpaceMemberRole,
  TaskStatus,
} from '@prisma/client';
import {
  BOARD_CARD_FIELDS_MAX,
  BOARD_DONE_HIDE_DAYS,
  BOARD_MAX_CARDS,
  BOARD_NAME_MAX_LENGTH,
  BOARD_RECENT_HOURS,
  POSITION_STEP,
} from '../../common/constants';
import { AppError, ErrorCode } from '../../common/errors';
import { canManageTasks } from '../../identity/auth/user-role';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskAccessService } from '../access/task-access.service';
import { epicColor } from '../utils/epic-color.util';
import { filtersToPrisma, validateFilterGroup } from '../utils/task-filter.util';
import { normalizeStatusName } from '../utils/task-status.util';
import { TaskListStatusesService } from '../services/task-list-statuses.service';
import { TasksService } from '../services/tasks.service';
import { BoardAccessService, type SourceInput } from './board-access.service';

const CARD_FIELDS = [
  'key',
  'priority',
  'assignee',
  'due',
  'brand',
  'points',
  'epic',
  'labels',
  'type',
  'checklist',
  'subtasks',
  'flag',
] as const;

type BoardRecord = Prisma.BoardGetPayload<{
  include: { sources: true; columns: true; quickFilters: true; sprints: true };
}>;

@Injectable()
export class BoardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BoardAccessService,
    private readonly tasks: TasksService,
    private readonly taskAccess: TaskAccessService,
    private readonly statuses: TaskListStatusesService,
  ) {}

  async list(user: AuthUser) {
    const boards = await this.prisma.board.findMany({
      where: { isArchived: false },
      include: { sources: true, _count: { select: { columns: true, sprints: true } } },
      orderBy: { name: 'asc' },
    });
    const visible = [];
    for (const board of boards) {
      try {
        await this.access.assertCanView(user, board.sources);
        visible.push(board);
      } catch {
        /* not visible */
      }
    }
    return visible;
  }

  async get(user: AuthUser, boardId: string) {
    return this.load(user, boardId);
  }

  async create(
    user: AuthUser,
    input: {
      name: string;
      type: BoardType;
      sources: SourceInput[];
      filter?: unknown;
      swimlaneBy?: BoardSwimlane;
      defaultListId?: string;
    },
  ) {
    const name = input.name.trim();
    if (!name || name.length > BOARD_NAME_MAX_LENGTH) {
      throw AppError.badRequest('Название доски: 1–120 символов');
    }
    await this.access.assertCanCreate(user, input.sources);
    const filter = input.filter == null ? undefined : validateFilterGroup(input.filter);
    const listIds = await this.access.listIdsFor(input.sources);
    if (input.defaultListId && !listIds.includes(input.defaultListId)) {
      throw AppError.badRequest('Список по умолчанию не входит в источники');
    }
    const columns = await this.defaultColumns(listIds);
    return this.prisma.board.create({
      data: {
        name,
        type: input.type,
        ownerId: user.id,
        filter: filter as Prisma.InputJsonValue | undefined,
        swimlaneBy: input.swimlaneBy ?? BoardSwimlane.NONE,
        backlogEnabled: input.type === BoardType.SCRUM,
        doneHideDays: input.type === BoardType.KANBAN ? BOARD_DONE_HIDE_DAYS : null,
        defaultListId: input.defaultListId ?? listIds[0] ?? null,
        sources: {
          create: input.sources.map((source) => ({
            spaceId: source.spaceId ?? null,
            folderId: source.folderId ?? null,
            listId: source.listId ?? null,
          })),
        },
        columns: { create: columns },
      },
      include: { sources: true, columns: true },
    });
  }

  async update(
    user: AuthUser,
    boardId: string,
    input: {
      name?: string;
      filter?: unknown | null;
      swimlaneBy?: BoardSwimlane;
      swimlaneQueries?: unknown;
      backlogEnabled?: boolean;
      doneHideDays?: number | null;
      defaultListId?: string | null;
      cardColorBy?: BoardCardColor;
      cardFields?: string[] | null;
    },
  ) {
    const board = await this.load(user, boardId, true);
    if (input.backlogEnabled === true || (input.backlogEnabled === undefined && board.backlogEnabled)) {
      const listIds = await this.access.listIdsFor(board.sources);
      for (const listId of listIds) {
        await this.statuses.ensureBacklogStatus(listId);
      }
    }
    if (board.type === BoardType.SCRUM && input.backlogEnabled === false) {
      throw AppError.badRequest('У Scrum-доски бэклог всегда включён');
    }
    const cardFields = input.cardFields === undefined ? undefined : sanitizeCardFields(input.cardFields);
    return this.prisma.board.update({
      where: { id: boardId },
      data: {
        name: input.name?.trim(),
        filter:
          input.filter === undefined
            ? undefined
            : input.filter === null
              ? Prisma.DbNull
              : (validateFilterGroup(input.filter) as Prisma.InputJsonValue),
        swimlaneBy: input.swimlaneBy,
        swimlaneQueries:
          input.swimlaneQueries === undefined
            ? undefined
            : (input.swimlaneQueries as Prisma.InputJsonValue),
        backlogEnabled: board.type === BoardType.SCRUM ? true : input.backlogEnabled,
        doneHideDays: input.doneHideDays,
        defaultListId: input.defaultListId,
        cardColorBy: input.cardColorBy,
        cardFields: cardFields === undefined ? undefined : cardFields,
      },
      include: { sources: true, columns: true, quickFilters: true },
    });
  }

  async archive(user: AuthUser, boardId: string) {
    await this.load(user, boardId, true);
    await this.prisma.board.update({ where: { id: boardId }, data: { isArchived: true } });
    return { ok: true as const };
  }

  async replaceColumns(
    user: AuthUser,
    boardId: string,
    columns: Array<{ name: string; statusNames: string[]; minWip?: number | null; maxWip?: number | null }>,
  ) {
    await this.load(user, boardId, true);
    await this.prisma.$transaction(async (tx) => {
      await tx.boardColumn.deleteMany({ where: { boardId } });
      if (columns.length === 0) return;
      await tx.boardColumn.createMany({
        data: columns.map((column, index) => ({
          boardId,
          name: column.name.trim().slice(0, 80),
          position: (index + 1) * POSITION_STEP,
          statusNames: [...new Set(column.statusNames.map(normalizeStatusName).filter(Boolean))],
          minWip: column.minWip ?? null,
          maxWip: column.maxWip ?? null,
        })),
      });
    });
    return this.prisma.boardColumn.findMany({ where: { boardId }, orderBy: { position: 'asc' } });
  }

  async addQuickFilter(user: AuthUser, boardId: string, input: { name: string; filter: unknown }) {
    await this.load(user, boardId, true);
    const filter = validateFilterGroup(input.filter);
    const last = await this.prisma.boardQuickFilter.findFirst({
      where: { boardId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.boardQuickFilter.create({
      data: {
        boardId,
        name: input.name.trim().slice(0, 80),
        filter: filter as Prisma.InputJsonValue,
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
  }

  async removeQuickFilter(user: AuthUser, boardId: string, filterId: string) {
    await this.load(user, boardId, true);
    await this.prisma.boardQuickFilter.deleteMany({ where: { id: filterId, boardId } });
    return { ok: true as const };
  }

  async view(
    user: AuthUser,
    boardId: string,
    query: { q?: string; mine?: boolean; recent?: boolean; quick?: string; assigneeId?: string },
  ) {
    const board = await this.load(user, boardId);
    const listIds = await this.access.listIdsFor(board.sources);
    const and: Prisma.TaskWhereInput[] = [];
    if (board.filter) {
      and.push(filtersToPrisma(validateFilterGroup(board.filter)) as Prisma.TaskWhereInput);
    }
    const quickIds = (query.quick ?? '').split(',').map((item) => item.trim()).filter(Boolean);
    for (const id of quickIds) {
      const quick = board.quickFilters.find((item) => item.id === id);
      if (quick) and.push(filtersToPrisma(validateFilterGroup(quick.filter)) as Prisma.TaskWhereInput);
    }
    if (query.mine) and.push({ assignees: { some: { userId: user.id } } });
    if (query.assigneeId) and.push({ assignees: { some: { userId: query.assigneeId } } });
    if (query.recent) {
      and.push({ updatedAt: { gt: new Date(Date.now() - BOARD_RECENT_HOURS * 3_600_000) } });
    }
    if (query.q?.trim()) {
      and.push({ title: { contains: query.q.trim(), mode: 'insensitive' } });
    }
    const active = board.sprints.find((sprint) => sprint.state === SprintState.ACTIVE) ?? null;
    if (board.type === BoardType.SCRUM) {
      and.push(active ? { sprintId: active.id } : { id: { in: [] } });
    }
    if (board.backlogEnabled) {
      and.push({ OR: [{ listStatusId: null }, { listStatus: { isBacklog: false } }] });
    }
    if (board.type === BoardType.KANBAN && board.doneHideDays != null) {
      const cutoff = new Date(Date.now() - board.doneHideDays * 86_400_000);
      and.push({
        NOT: { status: TaskStatus.DONE, completedAt: { lt: cutoff } },
      });
    }
    const rows = await this.prisma.task.findMany({
      where: {
        listId: { in: listIds },
        deletedAt: null,
        parentTaskId: null,
        ...(and.length ? { AND: and } : {}),
      },
      orderBy: { rank: 'asc' },
      take: BOARD_MAX_CARDS + 1,
      include: {
        assignees: { orderBy: { assignedAt: 'asc' } },
        list: { select: { id: true, name: true, spaceId: true } },
        listStatus: true,
        taskType: true,
        epic: { select: { id: true, key: true, title: true } },
        labels: { include: { label: true } },
        checklist: true,
        _count: { select: { children: true } },
        children: { where: { deletedAt: null }, select: { status: true } },
      },
    });
    const truncated = rows.length > BOARD_MAX_CARDS;
    const tasks = truncated ? rows.slice(0, BOARD_MAX_CARDS) : rows;
    const statusGroups = await Promise.all(listIds.map((id) => this.statuses.resolveForList(id)));
    const statusesByList = new Map(listIds.map((id, index) => [id, statusGroups[index] ?? []]));
    const rights = await this.rightsFor(user, tasks.map((task) => task.list.spaceId));
    const columns = [...board.columns].sort((a, b) => a.position - b.position);
    const unmapped = new Map<string, { name: string; count: number }>();
    const cards: Array<{
      id: string;
      columnId: string;
      laneKey: string;
      epicTitle: string | null;
      domainLabel: string | null;
      [key: string]: unknown;
    }> = [];
    for (const task of tasks) {
      const statusName = task.listStatus?.name ?? task.status;
      const normalized = normalizeStatusName(statusName);
      const column = columns.find((item) => item.statusNames.includes(normalized));
      if (!column) {
        const bucket = unmapped.get(normalized) ?? { name: statusName, count: 0 };
        bucket.count += 1;
        unmapped.set(normalized, bucket);
        continue;
      }
      const listStatuses = statusesByList.get(task.listId) ?? [];
      const availableColumnIds = columns
        .filter((item) =>
          listStatuses.some(
            (status) => !status.isBacklog && item.statusNames.includes(normalizeStatusName(status.name)),
          ),
        )
        .map((item) => item.id);
      const manage =
        rights.manageAll || rights.manageSpaces.has(task.list.spaceId);
      const assigned = task.assignees.some((row) => row.userId === user.id);
      const days = Math.max(
        0,
        Math.floor((Date.now() - task.statusChangedAt.getTime()) / 86_400_000),
      );
      cards.push({
        id: task.id,
        key: task.key,
        title: task.title,
        priority: task.priority,
        status: task.status,
        listStatusId: task.listStatusId,
        statusName,
        rank: task.rank,
        listId: task.listId,
        listName: task.list.name,
        assigneeIds: task.assignees.map((row) => row.userId),
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        domainLabel: task.domainLabel,
        hostEntityId: task.hostEntityId,
        isStuck: task.isStuck,
        stuckReason: task.stuckReason,
        taskTypeId: task.taskTypeId,
        taskTypeName: task.taskType?.name ?? null,
        taskTypeKey: task.taskType?.key ?? null,
        taskTypeColor: task.taskType?.color ?? null,
        epicId: task.epicId,
        epicKey: task.epic?.key ?? null,
        epicTitle: task.epic?.title ?? null,
        epicColor: task.epicId ? epicColor(task.epicId) : null,
        storyPoints: task.storyPoints == null ? null : Number(task.storyPoints),
        labels: task.labels.map((row) => ({ id: row.label.id, name: row.label.name })),
        checklistDone: task.checklist.filter((item) => item.isDone).length,
        checklistTotal: task.checklist.length,
        subtaskDone: task.children.filter((child) => child.status === TaskStatus.DONE).length,
        subtaskTotal: task._count.children,
        statusChangedAt: task.statusChangedAt.toISOString(),
        daysInColumn: days,
        availableColumnIds,
        canMove: manage || assigned,
        canEdit: manage,
        sprintId: task.sprintId,
        columnId: column.id,
        laneKey: laneKey(board.swimlaneBy, task, board.swimlaneQueries),
      });
    }
    const lanes = uniqueLanes(board, cards);
    return {
      board: {
        id: board.id,
        name: board.name,
        type: board.type,
        swimlaneBy: board.swimlaneBy,
        backlogEnabled: board.backlogEnabled,
        doneHideDays: board.doneHideDays,
        cardColorBy: board.cardColorBy,
        cardFields: board.cardFields,
        defaultListId: board.defaultListId,
        filter: board.filter,
      },
      columns: columns.map((column) => ({
        id: column.id,
        name: column.name,
        position: column.position,
        minWip: column.minWip,
        maxWip: column.maxWip,
        statusNames: column.statusNames,
        count: cards.filter((card) => card.columnId === column.id).length,
      })),
      lanes,
      cards,
      unmapped: [...unmapped.values()],
      truncated,
      activeSprint: active
        ? {
            id: active.id,
            name: active.name,
            goal: active.goal,
            startDate: active.startDate?.toISOString() ?? null,
            endDate: active.endDate?.toISOString() ?? null,
            daysLeft: active.endDate
              ? Math.ceil((active.endDate.getTime() - Date.now()) / 86_400_000)
              : null,
          }
        : null,
      quickFilters: board.quickFilters.map((item) => ({ id: item.id, name: item.name, filter: item.filter })),
    };
  }

  async moveCard(
    user: AuthUser,
    boardId: string,
    taskId: string,
    input: {
      columnId: string;
      laneKey?: string;
      beforeId?: string | null;
      afterId?: string | null;
      dueDate?: string | null;
    },
  ) {
    const board = await this.load(user, boardId);
    const level = await this.taskAccess.resolveLevel(user, taskId);
    if (level === 'view') throw AppError.forbidden();
    const column = board.columns.find((item) => item.id === input.columnId);
    if (!column) throw AppError.notFound('Колонка не найдена');
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: { listStatus: true, assignees: { orderBy: { assignedAt: 'asc' } } },
    });
    if (!task) throw AppError.notFound();
    const columns = await this.statuses.resolveForList(task.listId);
    const match = columns.find(
      (status) => !status.isBacklog && column.statusNames.includes(normalizeStatusName(status.name)),
    );
    if (!match) {
      throw new AppError(
        ErrorCode.BOARD_COLUMN_UNAVAILABLE,
        'В списке этой задачи нет статуса для колонки',
        HttpStatus.CONFLICT,
      );
    }
    const currentLane = laneKey(board.swimlaneBy, task, board.swimlaneQueries);
    const lane =
      input.laneKey && input.laneKey !== currentLane
        ? lanePatch(board.swimlaneBy, input.laneKey, level)
        : {};
    return this.tasks.move(user, taskId, {
      listStatusId: match.id,
      rankBeforeId: input.beforeId === undefined ? undefined : input.beforeId,
      rankAfterId: input.afterId === undefined ? undefined : input.afterId,
      dueDate: input.dueDate,
      ...lane,
    });
  }

  async createCard(user: AuthUser, boardId: string, title: string) {
    const board = await this.load(user, boardId);
    if (!board.defaultListId) {
      throw AppError.badRequest('Укажите список по умолчанию в настройках доски');
    }
    const columns = [...board.columns].sort((a, b) => a.position - b.position);
    const statuses = await this.statuses.resolveForList(board.defaultListId);
    const first = columns[0];
    const match = first
      ? statuses.find(
          (status) => !status.isBacklog && first.statusNames.includes(normalizeStatusName(status.name)),
        )
      : statuses.find((status) => !status.isBacklog);
    const active = board.sprints.find((sprint) => sprint.state === SprintState.ACTIVE);
    return this.tasks.createInList(user, board.defaultListId, {
      title,
      listStatusId: match?.id,
      sprintId: board.type === BoardType.SCRUM ? (active?.id ?? null) : undefined,
    });
  }

  async backlog(user: AuthUser, boardId: string) {
    const board = await this.load(user, boardId);
    const listIds = await this.access.listIdsFor(board.sources);
    const tasks = await this.prisma.task.findMany({
      where: {
        listId: { in: listIds },
        deletedAt: null,
        parentTaskId: null,
        listStatus: { isBacklog: true },
        sprintId: null,
      },
      orderBy: { rank: 'asc' },
      include: {
        assignees: { orderBy: { assignedAt: 'asc' } },
        epic: { select: { id: true, key: true, title: true } },
        taskType: true,
      },
    });
    const sprints = board.sprints
      .filter((sprint) => sprint.state !== SprintState.CLOSED)
      .sort((a, b) => a.position - b.position);
    const sprintTasks = await this.prisma.task.findMany({
      where: {
        sprintId: { in: sprints.map((sprint) => sprint.id) },
        deletedAt: null,
        parentTaskId: null,
      },
      orderBy: { rank: 'asc' },
      include: { assignees: { orderBy: { assignedAt: 'asc' } }, epic: { select: { id: true, title: true, key: true } } },
    });
    const epics = await this.prisma.task.findMany({
      where: {
        listId: { in: listIds },
        deletedAt: null,
        taskType: { key: 'epic' },
      },
      select: { id: true, key: true, title: true, storyPoints: true },
      orderBy: { rank: 'asc' },
    });
    return {
      tasks: tasks.map(presentBacklogTask),
      sprints: sprints.map((sprint) => ({
        ...sprint,
        points: sprintTasks
          .filter((task) => task.sprintId === sprint.id)
          .reduce((sum, task) => sum + (task.storyPoints == null ? 0 : Number(task.storyPoints)), 0),
        tasks: sprintTasks.filter((task) => task.sprintId === sprint.id).map(presentBacklogTask),
      })),
      epics: epics.map((epic) => ({ ...epic, color: epicColor(epic.id), storyPoints: epic.storyPoints == null ? null : Number(epic.storyPoints) })),
    };
  }

  async createBacklogTask(user: AuthUser, boardId: string, input: { title: string; listId?: string }) {
    const board = await this.load(user, boardId);
    const listIds = await this.access.listIdsFor(board.sources);
    const listId = input.listId ?? board.defaultListId ?? listIds[0];
    if (!listId || !listIds.includes(listId)) {
      throw AppError.badRequest('Список не входит в доску');
    }
    const columns = await this.statuses.ensureBacklogStatus(listId);
    const backlog = columns.find((column) => column.isBacklog);
    return this.tasks.createInList(user, listId, {
      title: input.title,
      listStatusId: backlog?.id,
      assigneeIds: [],
    });
  }

  private async load(user: AuthUser, boardId: string, configure = false): Promise<BoardRecord> {
    const board = await this.prisma.board.findFirst({
      where: { id: boardId, isArchived: false },
      include: { sources: true, columns: true, quickFilters: { orderBy: { position: 'asc' } }, sprints: true },
    });
    if (!board) throw AppError.notFound();
    await this.access.assertCanView(user, board.sources);
    if (configure) await this.access.assertCanConfigure(user, board);
    return board;
  }

  private async defaultColumns(listIds: string[]) {
    const groups = await Promise.all(listIds.map((id) => this.statuses.resolveForList(id)));
    const byName = new Map<string, { name: string; order: number }>();
    for (const statuses of groups) {
      for (const status of statuses) {
        if (status.category === TaskStatus.CANCELLED || status.isBacklog) continue;
        const key = normalizeStatusName(status.name);
        const current = byName.get(key);
        if (!current || status.order < current.order) {
          byName.set(key, { name: status.name, order: status.order });
        }
      }
    }
    return [...byName.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([statusName, meta], index) => ({
        name: meta.name,
        position: (index + 1) * POSITION_STEP,
        statusNames: [statusName],
      }));
  }

  private async rightsFor(user: AuthUser, spaceIds: string[]) {
    if (canManageTasks(user.role)) {
      return { manageAll: true, manageSpaces: new Set<string>() };
    }
    const unique = [...new Set(spaceIds)];
    const members = await this.prisma.taskSpaceMember.findMany({
      where: { userId: user.id, spaceId: { in: unique }, role: { not: TaskSpaceMemberRole.VIEWER } },
      select: { spaceId: true },
    });
    return { manageAll: false, manageSpaces: new Set(members.map((row) => row.spaceId)) };
  }
}

function sanitizeCardFields(fields: string[] | null): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (!fields) return Prisma.DbNull;
  const picked = fields.filter((field) => (CARD_FIELDS as readonly string[]).includes(field)).slice(0, BOARD_CARD_FIELDS_MAX);
  return picked;
}

function laneKey(
  swimlane: BoardSwimlane,
  task: {
    assignees: Array<{ userId: string }>;
    epicId: string | null;
    hostEntityId: string | null;
    priority: TaskPriority;
    title: string;
  },
  queries: Prisma.JsonValue,
): string {
  if (swimlane === BoardSwimlane.ASSIGNEE) return task.assignees[0]?.userId ?? 'unassigned';
  if (swimlane === BoardSwimlane.EPIC) return task.epicId ?? 'none';
  if (swimlane === BoardSwimlane.BRAND) return task.hostEntityId ?? 'none';
  if (swimlane === BoardSwimlane.PRIORITY) return task.priority;
  if (swimlane === BoardSwimlane.QUERIES && Array.isArray(queries)) {
    for (const query of queries) {
      if (query && typeof query === 'object' && 'key' in query && 'titleContains' in query) {
        const needle = String((query as { titleContains?: string }).titleContains ?? '').toLowerCase();
        if (needle && task.title.toLowerCase().includes(needle)) return String((query as { key: string }).key);
      }
    }
    return 'other';
  }
  return 'all';
}

function lanePatch(
  swimlane: BoardSwimlane,
  lane: string | undefined,
  level: 'manage' | 'assignee' | 'view',
): {
  assigneeIds?: string[];
  epicId?: string | null;
  hostEntityId?: string | null;
  priority?: TaskPriority;
} {
  if (!lane || swimlane === BoardSwimlane.NONE || swimlane === BoardSwimlane.QUERIES) return {};
  if (level !== 'manage') {
    throw AppError.forbidden();
  }
  if (swimlane === BoardSwimlane.ASSIGNEE) {
    return { assigneeIds: lane === 'unassigned' ? [] : [lane] };
  }
  if (swimlane === BoardSwimlane.EPIC) return { epicId: lane === 'none' ? null : lane };
  if (swimlane === BoardSwimlane.BRAND) return { hostEntityId: lane === 'none' ? null : lane };
  if (swimlane === BoardSwimlane.PRIORITY && (Object.values(TaskPriority) as string[]).includes(lane)) {
    return { priority: lane as TaskPriority };
  }
  return {};
}

function uniqueLanes(
  board: BoardRecord,
  cards: Array<{ laneKey: string; epicTitle?: string | null; domainLabel?: string | null }>,
) {
  const keys = new Set(cards.map((card) => card.laneKey));
  if (board.swimlaneBy === BoardSwimlane.NONE) return [{ key: 'all', label: '' }];
  return [...keys].map((key) => ({
    key,
    label:
      key === 'unassigned' || key === 'none' || key === 'other'
        ? key === 'unassigned'
          ? 'Не назначено'
          : key === 'none'
            ? 'Без значения'
            : 'Остальные'
        : (cards.find((card) => card.laneKey === key)?.epicTitle ??
          cards.find((card) => card.laneKey === key)?.domainLabel ??
          key),
  }));
}

function presentBacklogTask(task: {
  id: string;
  key: string;
  title: string;
  rank: string;
  priority: TaskPriority;
  storyPoints: Prisma.Decimal | null;
  epicId: string | null;
  sprintId?: string | null;
  assignees: Array<{ userId: string }>;
  epic?: { id: string; key: string; title: string } | null;
}) {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    rank: task.rank,
    priority: task.priority,
    storyPoints: task.storyPoints == null ? null : Number(task.storyPoints),
    epicId: task.epicId,
    epicTitle: task.epic?.title ?? null,
    epicColor: task.epicId ? epicColor(task.epicId) : null,
    sprintId: task.sprintId ?? null,
    assigneeIds: task.assignees.map((row) => row.userId),
  };
}
