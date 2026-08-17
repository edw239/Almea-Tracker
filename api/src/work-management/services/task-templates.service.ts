import { Injectable } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import {
  POSITION_STEP,
  TEMPLATE_NAME_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { nextPosition } from '../utils/task-position.util';
import { parseTemplateItems, type TemplateItem } from '../utils/task-template.util';
import { TaskListStatusesService } from './task-list-statuses.service';

@Injectable()
export class TaskTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
  ) {}

  async listForList(user: AuthUser, listId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) throw AppError.notFound();
    await this.spaces.getVisibleSpace(user, list.spaceId);
    return this.prisma.taskTemplate.findMany({
      where: {
        isActive: true,
        OR: [
          { listId },
          { spaceId: list.spaceId, listId: null },
          { spaceId: null, listId: null },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(
    user: AuthUser,
    input: { name: string; items: unknown; spaceId?: string; listId?: string },
  ) {
    const name = input.name.trim();
    if (!name || name.length > TEMPLATE_NAME_MAX_LENGTH) {
      throw AppError.badRequest('Некорректное имя шаблона');
    }
    const items = parseTemplateItems(input.items);
    let spaceId = input.spaceId ?? null;
    let listId = input.listId ?? null;

    if (listId) {
      const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
      if (!list) throw AppError.notFound();
      await this.spaces.assertCanManageSpace(user, list.spaceId);
      spaceId = list.spaceId;
    } else if (spaceId) {
      await this.spaces.assertCanManageSpace(user, spaceId);
    } else if (user.role !== UserRole.GLOBAL_ADMIN) {
      throw AppError.forbidden();
    }

    return this.prisma.taskTemplate.create({
      data: {
        name,
        items,
        spaceId,
        listId,
        createdBy: user.id,
      },
    });
  }

  async expandIntoList(user: AuthUser, listId: string, templateId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) throw AppError.notFound();
    await this.spaces.assertCanCreateTaskInList(user, list);

    const template = await this.prisma.taskTemplate.findFirst({
      where: { id: templateId, isActive: true },
    });
    if (!template) throw AppError.notFound();
    this.assertTemplateApplies(template, list);

    const items = parseTemplateItems(template.items);
    const columns = await this.statuses.resolveForList(listId);
    const open = this.statuses.defaultForCategory(columns, TaskStatus.OPEN);
    const last = await this.prisma.task.findFirst({
      where: { listId, deletedAt: null, parentTaskId: null },
      orderBy: { position: 'desc' },
    });
    let position = last?.position ?? 0;

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const item of items) {
        position = nextPosition(position);
        const task = await this.createTaskFromItem(tx, {
          listId,
          userId: user.id,
          item,
          listStatusId: open?.id ?? null,
          position,
          parentTaskId: null,
        });
        created.push(task);
        for (const sub of item.subtasks ?? []) {
          position = nextPosition(position);
          await this.createTaskFromItem(tx, {
            listId,
            userId: user.id,
            item: { title: sub.title, priority: sub.priority },
            listStatusId: open?.id ?? null,
            position,
            parentTaskId: task.id,
          });
        }
      }
      return created;
    });
  }

  private assertTemplateApplies(
    template: { spaceId: string | null; listId: string | null },
    list: { id: string; spaceId: string },
  ) {
    if (template.listId && template.listId !== list.id) {
      throw AppError.badRequest('Шаблон привязан к другому списку');
    }
    if (template.spaceId && template.spaceId !== list.spaceId) {
      throw AppError.badRequest('Шаблон привязан к другому space');
    }
  }

  private async createTaskFromItem(
    tx: Prisma.TransactionClient,
    input: {
      listId: string;
      userId: string;
      item: Pick<TemplateItem, 'title' | 'description' | 'priority' | 'checklist'>;
      listStatusId: string | null;
      position: number;
      parentTaskId: string | null;
    },
  ) {
    const title = input.item.title.trim().slice(0, TITLE_MAX_LENGTH);
    return tx.task.create({
      data: {
        listId: input.listId,
        parentTaskId: input.parentTaskId,
        ownerUserId: input.userId,
        title,
        description: input.item.description?.trim(),
        status: TaskStatus.OPEN,
        listStatusId: input.listStatusId,
        priority: input.item.priority ?? TaskPriority.MEDIUM,
        position: input.position,
        assignees: { create: { userId: input.userId } },
        checklist: input.item.checklist?.length
          ? {
              create: input.item.checklist.map((row, index) => ({
                text: row.text,
                position: (index + 1) * POSITION_STEP,
              })),
            }
          : undefined,
      },
      include: { assignees: true, checklist: true },
    });
  }
}
