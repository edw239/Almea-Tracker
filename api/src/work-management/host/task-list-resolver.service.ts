import { Injectable } from '@nestjs/common';
import { POSITION_STEP } from '../../common/constants';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskListStatusesService } from '../services/task-list-statuses.service';

/**
 * Host plugin: domain entity → system list. Idempotent by (spaceId, systemKey).
 */
@Injectable()
export class TaskListResolverService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statuses: TaskListStatusesService,
  ) {}

  async ensureEntityList(params: {
    spaceId: string;
    systemKey: string;
    name: string;
    domainEntityId: string;
    folderId?: string | null;
  }) {
    const existing = await this.prisma.taskList.findUnique({
      where: { spaceId_systemKey: { spaceId: params.spaceId, systemKey: params.systemKey } },
    });
    if (existing) {
      return existing;
    }
    const last = await this.prisma.taskList.findFirst({
      where: { spaceId: params.spaceId },
      orderBy: { position: 'desc' },
    });
    const created = await this.prisma.taskList.create({
      data: {
        spaceId: params.spaceId,
        folderId: params.folderId ?? null,
        name: params.name,
        systemKey: params.systemKey,
        domainEntityId: params.domainEntityId,
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
    await this.statuses.seedDefaults(params.spaceId, created.id);
    return created;
  }
}
