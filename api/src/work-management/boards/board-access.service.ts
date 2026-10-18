import { Injectable } from '@nestjs/common';
import { TaskSpaceMemberRole, type Board } from '@prisma/client';
import { SYSTEM_SPACE_PERSONAL } from '../../common/constants';
import { AppError } from '../../common/errors';
import { hasCompanyWorkScope } from '../../identity/auth/user-role';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';

export type SourceInput = {
  spaceId?: string | null;
  folderId?: string | null;
  listId?: string | null;
};

@Injectable()
export class BoardAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
  ) {}

  async assertCanCreate(user: AuthUser, sources: SourceInput[]): Promise<void> {
    if (sources.length === 0) {
      throw AppError.badRequest('У доски должен быть хотя бы один источник');
    }
    const spaceIds = await this.spaceIdsForSources(sources);
    for (const spaceId of spaceIds) {
      const space = await this.spaces.getVisibleSpace(user, spaceId);
      const full = await this.prisma.taskSpace.findUnique({
        where: { id: space.id },
        select: { isSystem: true, systemKey: true },
      });
      if (full?.isSystem && full.systemKey === SYSTEM_SPACE_PERSONAL) {
        throw AppError.badRequest('Личное пространство нельзя поставить на доску');
      }
      if (hasCompanyWorkScope(user.role)) continue;
      const member = await this.prisma.taskSpaceMember.findUnique({
        where: { spaceId_userId: { spaceId, userId: user.id } },
      });
      if (!member || member.role === TaskSpaceMemberRole.VIEWER) {
        throw AppError.forbidden();
      }
    }
  }

  async assertCanConfigure(user: AuthUser, board: Pick<Board, 'ownerId'>): Promise<void> {
    if (board.ownerId === user.id || hasCompanyWorkScope(user.role)) return;
    throw AppError.forbidden();
  }

  async assertCanView(
    user: AuthUser,
    sources: SourceInput[],
  ): Promise<void> {
    const spaceIds = await this.spaceIdsForSources(sources);
    let visible = 0;
    for (const spaceId of spaceIds) {
      try {
        await this.spaces.getVisibleSpace(user, spaceId);
        visible += 1;
      } catch {
        /* hidden source does not reveal the board by itself */
      }
    }
    if (visible === 0) {
      throw AppError.notFound();
    }
  }

  async listIdsFor(sources: SourceInput[]): Promise<string[]> {
    const ids = new Set<string>();
    for (const source of sources) {
      if (source.listId) {
        ids.add(source.listId);
        continue;
      }
      const lists = await this.prisma.taskList.findMany({
        where: {
          isArchived: false,
          ...(source.spaceId ? { spaceId: source.spaceId } : {}),
          ...(source.folderId ? { folderId: source.folderId } : {}),
          space: { NOT: { isSystem: true, systemKey: SYSTEM_SPACE_PERSONAL } },
        },
        select: { id: true },
      });
      for (const list of lists) ids.add(list.id);
    }
    return [...ids];
  }

  private async spaceIdsForSources(sources: SourceInput[]): Promise<string[]> {
    const ids = new Set<string>();
    for (const source of sources) {
      const filled = [source.spaceId, source.folderId, source.listId].filter(Boolean);
      if (filled.length !== 1) {
        throw AppError.badRequest('Источник доски — ровно одно: пространство, папка или список');
      }
      if (source.spaceId) {
        ids.add(source.spaceId);
        continue;
      }
      if (source.folderId) {
        const folder = await this.prisma.taskFolder.findFirst({
          where: { id: source.folderId, isArchived: false },
          select: { spaceId: true },
        });
        if (!folder) throw AppError.notFound('Папка не найдена');
        ids.add(folder.spaceId);
        continue;
      }
      const listId = source.listId;
      if (!listId) throw AppError.badRequest('Источник доски — ровно одно: пространство, папка или список');
      const list = await this.prisma.taskList.findFirst({
        where: { id: listId, isArchived: false },
        select: { spaceId: true },
      });
      if (!list) throw AppError.notFound('Список не найден');
      ids.add(list.spaceId);
    }
    return [...ids];
  }
}
