import { Injectable } from '@nestjs/common';
import { TaskSpaceMemberRole, TaskStatus } from '@prisma/client';
import { AppError } from '../../common/errors';
import { hasCompanyWorkScope } from '../../identity/auth/user-role';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';

@Injectable()
export class ColleagueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceAccess: TaskSpaceAccessService,
  ) {}

  async getProfile(viewer: AuthUser, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, jobTitle: true, isActive: true },
    });
    if (!user || !user.isActive) {
      throw AppError.notFound();
    }

    const scope = await this.spaceAccess.listVisibleSpaceIds(viewer);
    const visibility =
      scope === 'all'
        ? {}
        : {
            list: {
              space: {
                OR: [{ isSystem: true }, { id: { in: scope } }],
              },
            },
          };

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        AND: [
          visibility,
          {
            OR: [
              { assignees: { some: { userId } } },
              { ownerUserId: userId },
              { createdByUserId: userId },
            ],
          },
        ],
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      take: 50,
      include: {
        assignees: true,
        list: { select: { id: true, name: true, spaceId: true } },
      },
    });

    const canSeeStats = await this.canSeeColleagueStats(viewer, userId);
    const open = tasks.filter(
      (task) => task.status !== TaskStatus.DONE && task.status !== TaskStatus.CANCELLED,
    );
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const overdue = open.filter((task) => task.dueDate && task.dueDate < start).length;

    return {
      id: user.id,
      name: user.name,
      role: user.role,
      jobTitle: user.jobTitle,
      tasks,
      stats: canSeeStats
        ? {
            open: open.length,
            overdue,
            shown: tasks.length,
          }
        : null,
    };
  }

  private async canSeeColleagueStats(viewer: AuthUser, colleagueId: string): Promise<boolean> {
    if (viewer.id === colleagueId || hasCompanyWorkScope(viewer.role)) {
      return true;
    }
    const owned = await this.prisma.taskSpaceMember.findMany({
      where: { userId: viewer.id, role: TaskSpaceMemberRole.OWNER },
      select: { spaceId: true },
    });
    if (owned.length === 0) {
      return false;
    }
    const shared = await this.prisma.taskSpaceMember.findFirst({
      where: {
        userId: colleagueId,
        spaceId: { in: owned.map((row) => row.spaceId) },
      },
      select: { spaceId: true },
    });
    return Boolean(shared);
  }
}
