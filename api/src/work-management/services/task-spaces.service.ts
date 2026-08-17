import { Injectable } from '@nestjs/common';
import { TaskSpaceMemberRole } from '@prisma/client';
import { POSITION_STEP } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { TaskListStatusesService } from './task-list-statuses.service';

@Injectable()
export class TaskSpacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TaskSpaceAccessService,
    private readonly statuses: TaskListStatusesService,
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

  async createSpace(user: AuthUser, name: string, description?: string) {
    const space = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskSpace.create({
        data: { name: name.trim(), description: description?.trim() },
      });
      await tx.taskSpaceMember.create({
        data: { spaceId: created.id, userId: user.id, role: TaskSpaceMemberRole.OWNER },
      });
      return created;
    });
    await this.statuses.seedDefaults(space.id, null);
    return space;
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
