import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { DEFAULT_STATUSES } from '../../common/constants';
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
