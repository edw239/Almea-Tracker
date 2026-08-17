import { Injectable } from '@nestjs/common';
import { TaskSpaceMemberRole, UserRole } from '@prisma/client';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from './task-space-access.service';

export type TaskAccessLevel = 'manage' | 'assignee' | 'view';

@Injectable()
export class TaskAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
  ) {}

  async getVisibleTask(user: AuthUser, taskId: string) {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, deletedAt: null },
      include: {
        list: { select: { id: true, spaceId: true } },
        assignees: { select: { userId: true } },
      },
    });
    if (!task) {
      throw AppError.notFound();
    }
    await this.spaces.getVisibleSpace(user, task.list.spaceId);
    return task;
  }

  async resolveLevel(user: AuthUser, taskId: string): Promise<TaskAccessLevel> {
    const task = await this.getVisibleTask(user, taskId);
    if (user.role === UserRole.GLOBAL_ADMIN) {
      return 'manage';
    }
    const member = await this.prisma.taskSpaceMember.findUnique({
      where: { spaceId_userId: { spaceId: task.list.spaceId, userId: user.id } },
    });
    if (member && member.role !== TaskSpaceMemberRole.VIEWER) {
      return 'manage';
    }
    const assigned = task.assignees.some((item) => item.userId === user.id);
    if (assigned) {
      return 'assignee';
    }
    return 'view';
  }

  async assertCanManageTask(user: AuthUser, taskId: string) {
    const level = await this.resolveLevel(user, taskId);
    if (level !== 'manage') {
      throw AppError.forbidden();
    }
  }
}
