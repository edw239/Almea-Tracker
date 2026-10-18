import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, TaskSpaceMemberRole } from '@prisma/client';
import { POSITION_STEP } from '../../common/constants';
import { AppError, ErrorCode } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { TaskListStatusesService } from './task-list-statuses.service';
import { TaskIdentityService } from './task-identity.service';
import { isSpaceKey, suggestSpaceKey, withKeySuffix } from '../utils/space-key.util';

@Injectable()
export class TaskSpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
    private readonly identity: TaskIdentityService,
  ) {}

  async listTree(user: AuthUser) {
    const scope = await this.access.listVisibleSpaceIds(user);
    const spaces = await this.prisma.taskSpace.findMany({
      where: {
        isArchived: false,
        ...(scope === 'all'
          ? {}
          : { OR: [{ isSystem: true }, { id: { in: scope } }] }),
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        folders: { where: { isArchived: false }, orderBy: { position: 'asc' } },
        lists: { where: { isArchived: false }, orderBy: { position: 'asc' } },
      },
    });
    return spaces;
  }

  async getSpace(user: AuthUser, spaceId: string) {
    await this.access.getVisibleSpace(user, spaceId);
    return this.prisma.taskSpace.findUniqueOrThrow({
      where: { id: spaceId },
      include: {
        folders: { where: { isArchived: false }, orderBy: { position: 'asc' } },
        lists: { where: { isArchived: false }, orderBy: { position: 'asc' } },
        members: true,
      },
    });
  }

  async createSpace(user: AuthUser, name: string, description?: string, key?: string) {
    const space = await this.prisma.$transaction(async (tx) => {
      const allocated = await allocateSpaceKey(tx, name, key);
      const created = await tx.taskSpace.create({
        data: { name: name.trim(), description: description?.trim(), key: allocated },
      });
      await tx.taskSpaceMember.create({
        data: { spaceId: created.id, userId: user.id, role: TaskSpaceMemberRole.OWNER },
      });
      return created;
    });
    await this.statuses.seedDefaults(space.id, null);
    return space;
  }

  async changeKey(user: AuthUser, spaceId: string, key: string) {
    await this.access.assertCanManageSpace(user, spaceId);
    const normalized = key.trim().toUpperCase();
    if (!isSpaceKey(normalized)) {
      throw new AppError(ErrorCode.SPACE_KEY_INVALID, 'Ключ: 2–10 латинских букв и цифр, с буквы', HttpStatus.BAD_REQUEST);
    }
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.taskSpace.findUniqueOrThrow({ where: { id: spaceId } });
      if (current.key === normalized) return current;
      const taken = await tx.taskSpace.findUnique({ where: { key: normalized } });
      if (taken) {
        throw new AppError(ErrorCode.SPACE_KEY_TAKEN, 'Такой ключ уже занят', HttpStatus.CONFLICT);
      }
      await tx.taskSpace.update({ where: { id: spaceId }, data: { key: normalized, taskSeq: 0 } });
      const tasks = await tx.task.findMany({
        where: { list: { spaceId }, deletedAt: null },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true, key: true },
      });
      for (const task of tasks) {
        const next = await this.identity.nextKey(tx, spaceId);
        if (next === task.key) continue;
        await tx.task.update({ where: { id: task.id }, data: { key: next } });
        await this.identity.rememberKey(tx, task.id, task.key);
      }
      return tx.taskSpace.findUniqueOrThrow({ where: { id: spaceId } });
    });
  }

  async createFolder(user: AuthUser, spaceId: string, name: string) {
    await this.access.assertCanManageSpace(user, spaceId);
    const last = await this.prisma.taskFolder.findFirst({
      where: { spaceId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.taskFolder.create({
      data: {
        spaceId,
        name: name.trim(),
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
  }

  async createList(user: AuthUser, spaceId: string, name: string, folderId?: string) {
    await this.access.assertCanManageSpace(user, spaceId);
    if (folderId) {
      const folder = await this.prisma.taskFolder.findFirst({
        where: { id: folderId, spaceId, isArchived: false },
      });
      if (!folder) {
        throw AppError.notFound('Папка не найдена');
      }
    }
    const last = await this.prisma.taskList.findFirst({
      where: { spaceId },
      orderBy: { position: 'desc' },
    });
    const list = await this.prisma.taskList.create({
      data: {
        spaceId,
        folderId: folderId ?? null,
        name: name.trim(),
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
    await this.statuses.seedDefaults(spaceId, list.id);
    return list;
  }
}

async function allocateSpaceKey(
  tx: Prisma.TransactionClient,
  name: string,
  preferred?: string,
): Promise<string> {
  const explicit = preferred?.trim().toUpperCase();
  if (explicit && !isSpaceKey(explicit)) {
    throw new AppError(
      ErrorCode.SPACE_KEY_INVALID,
      'Ключ: 2–10 латинских букв и цифр, с буквы',
      HttpStatus.BAD_REQUEST,
    );
  }
  const base = explicit || suggestSpaceKey(name);
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    const candidate = explicit && attempt > 1 ? null : withKeySuffix(base, attempt);
    if (!candidate || !isSpaceKey(candidate)) break;
    const taken = await tx.taskSpace.findUnique({ where: { key: candidate }, select: { id: true } });
    if (!taken) return candidate;
    if (explicit) {
      throw new AppError(ErrorCode.SPACE_KEY_TAKEN, 'Такой ключ уже занят', HttpStatus.CONFLICT);
    }
  }
  throw AppError.conflict('Не удалось подобрать ключ пространства');
}
