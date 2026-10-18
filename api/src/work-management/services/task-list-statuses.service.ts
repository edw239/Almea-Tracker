import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { BACKLOG_STATUS_NAME, DEFAULT_STATUSES } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TaskListStatusesService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveForList(listId: string) {
    const list = await this.prisma.taskList.findUnique({ where: { id: listId } });
    if (!list) {
      return [];
    }
    const own = await this.prisma.taskListStatus.findMany({
      where: { listId },
      orderBy: { order: 'asc' },
    });
    if (own.length > 0) {
      return own;
    }
    const spaceLevel = await this.prisma.taskListStatus.findMany({
      where: { spaceId: list.spaceId, listId: null },
      orderBy: { order: 'asc' },
    });
    if (spaceLevel.length > 0) {
      return spaceLevel;
    }
    await this.seedDefaults(list.spaceId, listId);
    return this.prisma.taskListStatus.findMany({
      where: { listId },
      orderBy: { order: 'asc' },
    });
  }

  async seedDefaults(spaceId: string, listId: string | null) {
    const existing = await this.prisma.taskListStatus.count({
      where: listId ? { listId } : { spaceId, listId: null },
    });
    if (existing > 0) {
      return;
    }
    await this.prisma.taskListStatus.createMany({
      data: DEFAULT_STATUSES.map((item) => ({
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

  async ensureBacklogStatus(listId: string) {
    const columns = await this.resolveForList(listId);
    if (columns.some((column) => column.isBacklog)) {
      return columns;
    }
    const list = await this.prisma.taskList.findUnique({ where: { id: listId } });
    if (!list) return columns;
    const minOrder = columns.reduce((min, column) => Math.min(min, column.order), 0);
    await this.prisma.taskListStatus.create({
      data: {
        spaceId: list.spaceId,
        listId,
        name: BACKLOG_STATUS_NAME,
        color: '#94a3b8',
        order: minOrder - 1,
        category: TaskStatus.OPEN,
        isDefault: false,
        isBacklog: true,
      },
    });
    return this.prisma.taskListStatus.findMany({
      where: { listId },
      orderBy: { order: 'asc' },
    });
  }

  defaultForCategory(
    statuses: Array<{ id: string; category: TaskStatus; isDefault: boolean }>,
    category: TaskStatus,
  ) {
    return (
      statuses.find((item) => item.category === category && item.isDefault) ??
      statuses.find((item) => item.category === category)
    );
  }
}
