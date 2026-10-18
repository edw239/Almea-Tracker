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
    const existing = await this.prisma.taskType.findMany({
      where: { spaceId },
      select: { key: true },
    });
    const keys = new Set(existing.map((item) => item.key));
    const missing = DEFAULT_TASK_TYPES.filter((item) => !keys.has(item.key));
    if (missing.length === 0) return;
    await this.prisma.taskType.createMany({
      data: missing.map((item) => ({
        spaceId,
        key: item.key,
        name: item.name,
        color: item.color,
        position: item.position,
        isSystem: true,
      })),
    });
  }

  async create(user: AuthUser, spaceId: string, input: { key: string; name: string; color?: string }) {
    await this.spaces.assertCanManageSpace(user, spaceId);
    const key = input.key.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key)) {
      throw AppError.badRequest('Ключ типа: латиница, с буквы');
    }
    const last = await this.prisma.taskType.findFirst({
      where: { spaceId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.taskType.create({
      data: {
        spaceId,
        key,
        name: input.name.trim(),
        color: input.color ?? '#64748b',
        position: (last?.position ?? 0) + 1,
        isSystem: false,
      },
    });
  }

  async update(
    user: AuthUser,
    typeId: string,
    input: { name?: string; color?: string },
  ) {
    const row = await this.prisma.taskType.findUnique({ where: { id: typeId } });
    if (!row) throw AppError.notFound();
    await this.spaces.assertCanManageSpace(user, row.spaceId);
    return this.prisma.taskType.update({
      where: { id: typeId },
      data: { name: input.name?.trim(), color: input.color },
    });
  }

  async remove(user: AuthUser, typeId: string) {
    const row = await this.prisma.taskType.findUnique({ where: { id: typeId } });
    if (!row) throw AppError.notFound();
    await this.spaces.assertCanManageSpace(user, row.spaceId);
    if (row.isSystem) {
      throw AppError.badRequest('Системный тип нельзя удалить');
    }
    const used = await this.prisma.task.count({ where: { taskTypeId: typeId, deletedAt: null } });
    if (used > 0) {
      throw AppError.badRequest('Тип используется задачами');
    }
    await this.prisma.taskType.delete({ where: { id: typeId } });
    return { ok: true as const };
  }
}
