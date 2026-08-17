import { Injectable } from '@nestjs/common';
import { TaskSpaceMemberRole, UserRole } from '@prisma/client';
import { SYSTEM_LIST_PERSONAL_INBOX, SYSTEM_SPACE_PERSONAL } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';

export type SpaceRecord = {
  id: string;
  isSystem: boolean;
  isArchived: boolean;
};

@Injectable()
export class TaskSpaceAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getVisibleSpace(user: AuthUser, spaceId: string): Promise<SpaceRecord> {
    const space = await this.prisma.taskSpace.findUnique({
      where: { id: spaceId },
      select: { id: true, isSystem: true, isArchived: true },
    });
    if (!space || space.isArchived) {
      throw AppError.notFound();
    }
    if (user.role === UserRole.GLOBAL_ADMIN || space.isSystem) {
      return space;
    }
    const member = await this.prisma.taskSpaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: user.id } },
    });
    if (!member) {
      throw AppError.notFound();
    }
    return space;
  }

  async assertCanManageSpace(user: AuthUser, spaceId: string): Promise<SpaceRecord> {
    const space = await this.getVisibleSpace(user, spaceId);
    if (user.role === UserRole.GLOBAL_ADMIN) {
      return space;
    }
    if (space.isSystem) {
      throw AppError.forbidden();
    }
    const member = await this.prisma.taskSpaceMember.findUnique({
      where: { spaceId_userId: { spaceId, userId: user.id } },
    });
    if (!member || member.role === TaskSpaceMemberRole.VIEWER) {
      throw AppError.forbidden();
    }
    return space;
  }

  async listVisibleSpaceIds(user: AuthUser): Promise<string[] | 'all'> {
    if (user.role === UserRole.GLOBAL_ADMIN) {
      return 'all';
    }
    const memberships = await this.prisma.taskSpaceMember.findMany({
      where: { userId: user.id },
      select: { spaceId: true },
    });
    return memberships.map((item) => item.spaceId);
  }

  /**
   * Creating a task in personal-inbox is allowed for any authenticated user.
   * Managing the system list itself remains admin-only via assertCanManageSpace.
   */
  async assertCanCreateTaskInList(
    user: AuthUser,
    list: { id: string; spaceId: string; systemKey: string | null; isArchived: boolean },
  ): Promise<void> {
    if (list.isArchived) {
      throw AppError.notFound();
    }
    const space = await this.getVisibleSpace(user, list.spaceId);
    if (list.systemKey === SYSTEM_LIST_PERSONAL_INBOX && space.isSystem) {
      const personal = await this.prisma.taskSpace.findFirst({
        where: { id: list.spaceId, systemKey: SYSTEM_SPACE_PERSONAL, isSystem: true },
      });
      if (personal) {
        return;
      }
    }
    await this.assertCanManageSpace(user, list.spaceId);
  }
}
