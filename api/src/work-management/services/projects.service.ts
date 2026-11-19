import { Injectable } from '@nestjs/common';
import { Prisma, ProjectMemberRole, ProjectStatus, TaskStatus } from '@prisma/client';
import {
  DEFAULT_TIMEZONE,
  KNOWN_SPACE_KEYS,
  POSITION_STEP,
  PROJECT_CONTRIBUTORS_MAX,
  PROJECT_LIST_MAX,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_TASK_PAGE,
  SYSTEM_SPACE_PROJECTS,
} from '../../common/constants';
import { AppError } from '../../common/errors';
import { isPrismaUniqueConflict } from '../../common/prisma-errors';
import { hasCompanyWorkScope } from '../../identity/auth/user-role';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { zonedCalendarDate } from '../../identity/utils/zoned-day.util';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import {
  normalizeHostEntityDisplayName,
  normalizeHostEntityNameKey,
} from '../utils/host-entity-name.util';
import {
  buildMemberRows,
  datesAreOrdered,
  decideListMoveProject,
  decideTaskProjectLink,
  formatProjectDate,
  gateStatusChange,
  isProjectReady,
  parseProjectDate,
  projectListSystemKey,
  projectSignal,
  type LinkDecision,
  type MemberDraft,
  type ProjectRef,
  type ProjectStatusName,
  type ProjectWorkStatus,
} from '../utils/project-rules.util';
import { isSpaceKey, withKeySuffix } from '../utils/space-key.util';
import { TaskListStatusesService } from './task-list-statuses.service';

const MEMBER_INCLUDE = {
  members: {
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
};

type MemberRow = {
  role: ProjectMemberRole;
  userId: string;
  user: { id: string; name: string };
};

type ProjectRecord = {
  id: string;
  name: string;
  outcome: string | null;
  startDate: Date | null;
  targetEndDate: Date | null;
  status: ProjectStatus;
  closedAt: Date | null;
  closeNote: string | null;
  listId: string | null;
  createdAt: Date;
  updatedAt: Date;
  members: MemberRow[];
};

export type ProjectWrite = {
  name?: string;
  outcome?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  status?: ProjectWorkStatus;
  leadUserId?: string | null;
  sponsorUserId?: string | null;
  contributorIds?: string[];
};

const OPEN_TASK: Prisma.TaskWhereInput = {
  deletedAt: null,
  parentTaskId: null,
  status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
};

const STATUS_ORDER: Record<ProjectStatusName, number> = {
  ACTIVE: 0,
  ON_HOLD: 1,
  DRAFT: 2,
  CLOSED: 3,
};

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceAccess: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
  ) {}

  async list(user: AuthUser, opts: { query?: string; includeClosed?: boolean }) {
    const query = opts.query?.trim() ?? '';
    if (query.length > PROJECT_NAME_MAX_LENGTH) {
      throw AppError.badRequest('Слишком длинный запрос');
    }
    const nameKey = query ? normalizeHostEntityNameKey(query) : undefined;
    const visible = await this.visibleWhere(user);
    const where: Prisma.ProjectWhereInput = {
      AND: [
        visible,
        opts.includeClosed ? {} : { status: { not: ProjectStatus.CLOSED } },
        nameKey ? { nameKey: { contains: nameKey } } : {},
      ],
    };
    const [total, rows] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        include: MEMBER_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: PROJECT_LIST_MAX,
      }),
    ]);
    const today = await this.todayFor(user.id);
    const counts = await this.openCounts(
      user,
      rows.map((row) => row.id),
    );
    const items = rows
      .map((row) => this.presentBase(row, counts.get(row.id) ?? 0, today))
      .sort((a, b) => {
        const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
        if (byStatus !== 0) return byStatus;
        if (a.targetEndDate === b.targetEndDate) return a.name.localeCompare(b.name, 'ru');
        if (!a.targetEndDate) return 1;
        if (!b.targetEndDate) return -1;
        return a.targetEndDate < b.targetEndDate ? -1 : 1;
      });
    return { items, truncated: total > items.length };
  }

  async get(user: AuthUser, id: string) {
    let project = await this.findVisible(user, id);
    if (!project.listId && hasCompanyWorkScope(user.role)) {
      await this.repairList(project.id, project.name);
      project = await this.findVisible(user, id);
    }
    const today = await this.todayFor(user.id);
    const visibility = await this.taskVisibility(user);
    const taskWhere: Prisma.TaskWhereInput = {
      projectId: id,
      deletedAt: null,
      parentTaskId: null,
      ...visibility,
    };
    const [openTaskCount, total, tasks, list] = await Promise.all([
      this.prisma.task.count({ where: { ...taskWhere, ...OPEN_TASK } }),
      this.prisma.task.count({ where: taskWhere }),
      this.prisma.task.findMany({
        where: taskWhere,
        orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
        take: PROJECT_TASK_PAGE,
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          list: { select: { id: true, name: true, spaceId: true, space: { select: { name: true } } } },
        },
      }),
      project.listId
        ? this.prisma.taskList.findUnique({
            where: { id: project.listId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
    ]);
    return {
      ...this.presentBase(project, openTaskCount, today),
      ...this.presentPeople(project.members),
      canManage: hasCompanyWorkScope(user.role),
      list,
      truncated: total > tasks.length,
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate ? task.dueDate.toISOString() : null,
        listId: task.list.id,
        listName: task.list.name,
        spaceId: task.list.spaceId,
        spaceName: task.list.space.name,
      })),
    };
  }

  async create(user: AuthUser, input: ProjectWrite & { name: string }) {
    this.assertManage(user);
    const name = this.normalizeName(input.name);
    const outcome = this.normalizeOutcome(input.outcome);
    const startDate = this.parseOptionalDate(input.startDate, null);
    const targetEndDate = this.parseOptionalDate(input.targetEndDate, null);
    this.assertDateOrder(startDate, targetEndDate);
    const members = await this.membersFrom(input, {
      leadUserId: null,
      sponsorUserId: null,
      contributorIds: [],
    });
    const status = input.status ?? ProjectStatus.DRAFT;
    this.assertGate(ProjectStatus.DRAFT, status, outcome, targetEndDate, members.leadUserId);
    const space = await this.ensureProjectsSpace();
    let createdListId: string | null = null;
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            name,
            nameKey: normalizeHostEntityNameKey(name),
            outcome,
            startDate,
            targetEndDate,
            status,
          },
        });
        const list = await this.ensureCoordinationList(tx, space.id, project.id, name);
        createdListId = list.created ? list.listId : null;
        if (members.rows.length > 0) {
          await tx.projectMember.createMany({
            data: members.rows.map((row) => ({
              projectId: project.id,
              userId: row.userId,
              role: row.role,
            })),
          });
        }
        return project;
      });
      if (createdListId) {
        await this.statuses.seedDefaults(space.id, createdListId);
      }
      return this.get(user, created.id);
    } catch (error) {
      this.rethrowNameConflict(error);
    }
  }

  async update(user: AuthUser, id: string, input: ProjectWrite) {
    this.assertManage(user);
    if (!this.hasWrite(input)) {
      throw AppError.badRequest('Нет полей для обновления');
    }
    const existing = await this.findVisible(user, id);
    if (existing.status === ProjectStatus.CLOSED) {
      throw AppError.projectClosed('Проект закрыт');
    }
    const name = input.name === undefined ? existing.name : this.normalizeName(input.name);
    const outcome = input.outcome === undefined ? existing.outcome : this.normalizeOutcome(input.outcome);
    const startDate = this.parseOptionalDate(input.startDate, existing.startDate);
    const targetEndDate = this.parseOptionalDate(input.targetEndDate, existing.targetEndDate);
    this.assertDateOrder(startDate, targetEndDate);
    const touchesMembers =
      input.leadUserId !== undefined ||
      input.sponsorUserId !== undefined ||
      input.contributorIds !== undefined;
    const members = touchesMembers ? await this.membersFrom(input, this.draftFrom(existing.members)) : null;
    const leadUserId = members ? members.leadUserId : this.leadId(existing.members);
    const status = input.status ?? existing.status;
    this.assertGate(existing.status, status, outcome, targetEndDate, leadUserId);
    const space = await this.ensureProjectsSpace();
    let createdListId: string | null = null;
    try {
      await this.prisma.$transaction(async (tx) => {
        const list = await this.ensureCoordinationList(tx, space.id, id, name);
        if (list.created) createdListId = list.listId;
        await tx.project.update({
          where: { id },
          data: {
            name,
            nameKey: normalizeHostEntityNameKey(name),
            outcome,
            startDate,
            targetEndDate,
            status,
          },
        });
        if (members) {
          await tx.projectMember.deleteMany({ where: { projectId: id } });
          if (members.rows.length > 0) {
            await tx.projectMember.createMany({
              data: members.rows.map((row) => ({
                projectId: id,
                userId: row.userId,
                role: row.role,
              })),
            });
          }
        }
      });
    } catch (error) {
      this.rethrowNameConflict(error);
    }
    if (createdListId) {
      await this.statuses.seedDefaults(space.id, createdListId);
    }
    return this.get(user, id);
  }

  async close(user: AuthUser, id: string, closeNote: string) {
    this.assertManage(user);
    const note = closeNote.trim();
    if (!note) {
      throw AppError.badRequest('Запишите, что сдано');
    }
    const existing = await this.findVisible(user, id);
    if (existing.status === ProjectStatus.CLOSED) {
      throw AppError.conflict('Проект уже закрыт');
    }
    await this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.CLOSED,
        closedAt: new Date(),
        closeNote: note,
      },
    });
    return this.get(user, id);
  }

  async reopen(user: AuthUser, id: string) {
    this.assertManage(user);
    const existing = await this.findVisible(user, id);
    if (existing.status !== ProjectStatus.CLOSED) {
      throw AppError.badRequest('Проект не закрыт');
    }
    const leadUserId = this.leadId(existing.members);
    if (
      !isProjectReady({
        outcome: existing.outcome,
        targetEndDate: existing.targetEndDate ? formatProjectDate(existing.targetEndDate) : null,
        leadUserId,
      })
    ) {
      throw AppError.projectNotReady();
    }
    await this.prisma.project.update({
      where: { id },
      data: {
        status: ProjectStatus.ACTIVE,
        closedAt: null,
        closeNote: null,
      },
    });
    return this.get(user, id);
  }

  async resolveLink(
    tx: Prisma.TransactionClient,
    args: {
      mode: 'create' | 'update';
      listId: string;
      currentProjectId: string | null;
      requested: string | null | undefined;
    },
  ): Promise<string | null | undefined> {
    const coordination = await tx.project.findFirst({
      where: { listId: args.listId },
      select: { id: true, status: true },
    });
    const current = await this.projectRef(tx, args.currentProjectId);
    let requested: ProjectRef | null | undefined;
    if (args.requested === undefined) {
      requested = undefined;
    } else if (args.requested === null) {
      requested = null;
    } else {
      const row = await this.projectRef(tx, args.requested);
      if (!row) throw AppError.notFound('Проект не найден');
      requested = row;
    }
    return this.applyDecision(
      decideTaskProjectLink({
        mode: args.mode,
        coordination,
        current,
        requested,
      }),
    );
  }

  async projectIdAfterListMove(
    tx: Prisma.TransactionClient,
    currentProjectId: string | null,
    targetListId: string,
  ): Promise<string | undefined> {
    const target = await tx.project.findFirst({
      where: { listId: targetListId },
      select: { id: true, status: true },
    });
    const decision = decideListMoveProject({
      current: await this.projectRef(tx, currentProjectId),
      targetCoordination: target,
    });
    if (decision.error === 'CLOSED') {
      throw AppError.projectClosed();
    }
    return decision.projectId;
  }

  private applyDecision(decision: LinkDecision): string | null | undefined {
    if (decision.error === 'CLOSED') {
      throw AppError.projectClosed();
    }
    if (decision.error === 'COORDINATION_LOCKED') {
      throw AppError.badRequest('Задача этого списка принадлежит проекту');
    }
    return decision.projectId;
  }

  private async projectRef(
    tx: Prisma.TransactionClient,
    id: string | null,
  ): Promise<ProjectRef | null> {
    if (!id) return null;
    return tx.project.findUnique({ where: { id }, select: { id: true, status: true } });
  }

  private assertManage(user: AuthUser): void {
    if (!hasCompanyWorkScope(user.role)) {
      throw AppError.forbidden();
    }
  }

  private async findVisible(user: AuthUser, id: string): Promise<ProjectRecord> {
    const visible = await this.visibleWhere(user);
    const project = await this.prisma.project.findFirst({
      where: { id, AND: [visible] },
      include: MEMBER_INCLUDE,
    });
    if (!project) throw AppError.notFound();
    return project;
  }

  private async visibleWhere(user: AuthUser): Promise<Prisma.ProjectWhereInput> {
    if (hasCompanyWorkScope(user.role)) return {};
    const scope = await this.spaceAccess.listVisibleSpaceIds(user);
    const spaceIds = scope === 'all' ? [] : scope;
    return {
      OR: [
        { members: { some: { userId: user.id } } },
        {
          tasks: {
            some: {
              deletedAt: null,
              list: {
                space: {
                  OR: [{ isSystem: true }, ...(spaceIds.length > 0 ? [{ id: { in: spaceIds } }] : [])],
                },
              },
            },
          },
        },
      ],
    };
  }

  private async taskVisibility(user: AuthUser): Promise<Prisma.TaskWhereInput> {
    const scope = await this.spaceAccess.listVisibleSpaceIds(user);
    if (scope === 'all') return {};
    return {
      list: {
        space: {
          OR: [{ isSystem: true }, { id: { in: scope } }],
        },
      },
    };
  }

  private async openCounts(user: AuthUser, projectIds: string[]): Promise<Map<string, number>> {
    const counts = new Map<string, number>();
    if (projectIds.length === 0) return counts;
    const visibility = await this.taskVisibility(user);
    const grouped = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projectIds },
        ...OPEN_TASK,
        ...visibility,
      },
      _count: { _all: true },
    });
    for (const row of grouped) {
      if (row.projectId) counts.set(row.projectId, row._count._all);
    }
    return counts;
  }

  private async todayFor(userId: string): Promise<string> {
    const profile = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });
    return zonedCalendarDate(new Date(), profile?.timezone || DEFAULT_TIMEZONE);
  }

  private presentBase(project: ProjectRecord, openTaskCount: number, today: string) {
    const targetEndDate = project.targetEndDate ? formatProjectDate(project.targetEndDate) : null;
    const people = this.presentPeople(project.members);
    return {
      id: project.id,
      name: project.name,
      outcome: project.outcome,
      startDate: project.startDate ? formatProjectDate(project.startDate) : null,
      targetEndDate,
      status: project.status,
      closedAt: project.closedAt ? project.closedAt.toISOString() : null,
      closeNote: project.closeNote,
      listId: project.listId,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      openTaskCount,
      signal: projectSignal({
        status: project.status,
        targetEndDate,
        openTaskCount,
        today,
      }),
      lead: people.lead,
    };
  }

  private presentPeople(members: MemberRow[]) {
    return {
      lead: members.find((member) => member.role === ProjectMemberRole.LEAD)?.user ?? null,
      sponsor: members.find((member) => member.role === ProjectMemberRole.SPONSOR)?.user ?? null,
      contributors: members
        .filter((member) => member.role === ProjectMemberRole.CONTRIBUTOR)
        .map((member) => member.user),
    };
  }

  private async ensureProjectsSpace() {
    const existing = await this.prisma.taskSpace.findUnique({
      where: { systemKey: SYSTEM_SPACE_PROJECTS },
    });
    if (existing) return existing;
    const key = await this.allocateSpaceKey();
    try {
      const created = await this.prisma.taskSpace.create({
        data: {
          name: 'Координация проектов',
          description: 'Решения и вехи. Исполнение остаётся в пространствах процессов.',
          isSystem: true,
          systemKey: SYSTEM_SPACE_PROJECTS,
          key,
        },
      });
      await this.statuses.seedDefaults(created.id, null);
      return created;
    } catch (error) {
      if (!isPrismaUniqueConflict(error)) throw error;
      const again = await this.prisma.taskSpace.findUnique({
        where: { systemKey: SYSTEM_SPACE_PROJECTS },
      });
      if (again) return again;
      throw error;
    }
  }

  private async allocateSpaceKey(): Promise<string> {
    const base = KNOWN_SPACE_KEYS[SYSTEM_SPACE_PROJECTS] ?? 'PRJ';
    for (let attempt = 1; attempt <= 50; attempt += 1) {
      const candidate = withKeySuffix(base, attempt);
      if (!isSpaceKey(candidate)) break;
      const taken = await this.prisma.taskSpace.findUnique({
        where: { key: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
    throw AppError.conflict('Не удалось подобрать ключ пространства проектов');
  }

  private async repairList(projectId: string, name: string): Promise<void> {
    const space = await this.ensureProjectsSpace();
    const created = await this.prisma.$transaction((tx) =>
      this.ensureCoordinationList(tx, space.id, projectId, name),
    );
    if (created.created) {
      await this.statuses.seedDefaults(space.id, created.listId);
    }
  }

  private async ensureCoordinationList(
    tx: Prisma.TransactionClient,
    spaceId: string,
    projectId: string,
    name: string,
  ): Promise<{ listId: string; created: boolean }> {
    const systemKey = projectListSystemKey(projectId);
    const linked = await tx.project.findUnique({
      where: { id: projectId },
      select: { listId: true },
    });
    if (linked?.listId) {
      const list = await tx.taskList.findUnique({ where: { id: linked.listId } });
      if (list) {
        if (list.name !== name || list.isArchived) {
          await tx.taskList.update({
            where: { id: list.id },
            data: { name, isArchived: false },
          });
        }
        return { listId: list.id, created: false };
      }
    }
    const byKey = await tx.taskList.findUnique({
      where: { spaceId_systemKey: { spaceId, systemKey } },
    });
    if (byKey) {
      await tx.taskList.update({
        where: { id: byKey.id },
        data: { name, isArchived: false },
      });
      await tx.project.update({ where: { id: projectId }, data: { listId: byKey.id } });
      return { listId: byKey.id, created: false };
    }
    const last = await tx.taskList.findFirst({
      where: { spaceId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const created = await tx.taskList.create({
      data: {
        spaceId,
        name,
        systemKey,
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
    await tx.project.update({ where: { id: projectId }, data: { listId: created.id } });
    return { listId: created.id, created: true };
  }

  private async membersFrom(input: ProjectWrite, base: MemberDraft) {
    const draft: MemberDraft = {
      leadUserId: input.leadUserId === undefined ? base.leadUserId : input.leadUserId,
      sponsorUserId: input.sponsorUserId === undefined ? base.sponsorUserId : input.sponsorUserId,
      contributorIds: input.contributorIds === undefined ? base.contributorIds : input.contributorIds,
    };
    const built = buildMemberRows(draft);
    if (!built.ok) {
      if (built.error === 'TOO_MANY') {
        throw AppError.badRequest(`Не больше ${PROJECT_CONTRIBUTORS_MAX} участников`);
      }
      throw AppError.badRequest('У человека одна роль в проекте');
    }
    await this.assertActiveUsers(built.rows.map((row) => row.userId));
    return { ...built, leadUserId: draft.leadUserId };
  }

  private draftFrom(members: MemberRow[]): MemberDraft {
    return {
      leadUserId: this.leadId(members),
      sponsorUserId: members.find((member) => member.role === ProjectMemberRole.SPONSOR)?.userId ?? null,
      contributorIds: members
        .filter((member) => member.role === ProjectMemberRole.CONTRIBUTOR)
        .map((member) => member.userId),
    };
  }

  private leadId(members: MemberRow[]): string | null {
    return members.find((member) => member.role === ProjectMemberRole.LEAD)?.userId ?? null;
  }

  private async assertActiveUsers(ids: string[]): Promise<void> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return;
    const found = await this.prisma.user.findMany({
      where: { id: { in: unique }, isActive: true },
      select: { id: true },
    });
    if (found.length !== unique.length) {
      throw AppError.badRequest('Участник не найден или отключён');
    }
  }

  private assertGate(
    from: ProjectStatus,
    to: ProjectStatus,
    outcome: string | null,
    targetEndDate: Date | null,
    leadUserId: string | null,
  ): void {
    const gate = gateStatusChange({
      from,
      to,
      ready: isProjectReady({
        outcome,
        targetEndDate: targetEndDate ? formatProjectDate(targetEndDate) : null,
        leadUserId,
      }),
    });
    if (gate === 'OK') return;
    if (gate === 'NOT_READY') throw AppError.projectNotReady();
    if (gate === 'BACK_TO_DRAFT') {
      throw AppError.badRequest('Из работы в черновик проект не возвращается');
    }
    if (gate === 'USE_CLOSE') throw AppError.badRequest('Закрытие — отдельное действие');
    throw AppError.badRequest('Сначала откройте проект заново');
  }

  private normalizeName(name: string): string {
    try {
      return normalizeHostEntityDisplayName(name);
    } catch {
      throw AppError.badRequest('Некорректное имя проекта');
    }
  }

  private normalizeOutcome(outcome: string | null | undefined): string | null {
    if (outcome == null) return null;
    const trimmed = outcome.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private parseOptionalDate(value: string | null | undefined, fallback: Date | null): Date | null {
    if (value === undefined) return fallback;
    if (value === null) return null;
    const parsed = parseProjectDate(value);
    if (!parsed) throw AppError.badRequest('Дата в формате ГГГГ-ММ-ДД');
    return parsed;
  }

  private assertDateOrder(start: Date | null, target: Date | null): void {
    const startText = start ? formatProjectDate(start) : null;
    const targetText = target ? formatProjectDate(target) : null;
    if (!datesAreOrdered(startText, targetText)) {
      throw AppError.badRequest('Старт позже целевой даты');
    }
  }

  private hasWrite(input: ProjectWrite): boolean {
    return (
      input.name !== undefined ||
      input.outcome !== undefined ||
      input.startDate !== undefined ||
      input.targetEndDate !== undefined ||
      input.status !== undefined ||
      input.leadUserId !== undefined ||
      input.sponsorUserId !== undefined ||
      input.contributorIds !== undefined
    );
  }

  private rethrowNameConflict(error: unknown): never {
    if (isPrismaUniqueConflict(error)) {
      const target = (error as { meta?: { target?: unknown } }).meta?.target;
      const text = Array.isArray(target) ? target.join(',') : String(target ?? '');
      if (text.includes('name_key')) {
        throw AppError.conflict('Проект с таким именем уже есть');
      }
    }
    throw error;
  }
}
