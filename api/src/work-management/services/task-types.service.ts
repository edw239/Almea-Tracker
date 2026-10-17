import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { DEFAULT_TASK_TYPES } from '../../common/constants';

@Injectable()
export class TaskTypesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
  ) {}

  async listForSpace(user: AuthUser, spaceId: string) {
    await this.spaces.getVisibleSpace(user, spaceId);
    await this.ensureDefaults(spaceId);
    return this.prisma.taskType.findMany({
      where: { spaceId },
      orderBy: { position: 'asc' },
    });
  }

  async ensureDefaults(spaceId: string) {
    const count = await this.prisma.taskType.count({ where: { spaceId } });
    if (count > 0) {
      return;
    }
    await this.prisma.taskType.createMany({
      data: DEFAULT_TASK_TYPES.map((item) => ({
        spaceId,
        key: item.key,
        name: item.name,
        color: item.color,
        position: item.position,
        isSystem: true,
      })),
    });
  }
}
