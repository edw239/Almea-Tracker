import { Injectable } from '@nestjs/common';
import {
  HOST_ENTITY_TYPES,
  SYSTEM_SPACE_HOST,
  type HostEntityType,
} from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import { TaskListResolverService } from '../host/task-list-resolver.service';

export function systemKeyFor(entityType: string, entityId: string): string {
  return `entity:${entityType}:${entityId}`;
}

@Injectable()
export class TaskHostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TaskListResolverService,
    private readonly spaceAccess: TaskSpaceAccessService,
  ) {}

  async ensureHostSpace() {
    const existing = await this.prisma.taskSpace.findUnique({ where: { systemKey: SYSTEM_SPACE_HOST } });
    if (existing) return existing;
    return this.prisma.taskSpace.create({
      data: {
        name: 'Host',
        description: 'System space для entity-lists (бренд / партия / сделка).',
        isSystem: true,
        systemKey: SYSTEM_SPACE_HOST,
      },
    });
  }

  async ensureEntityList(
    user: AuthUser,
    input: { entityType: HostEntityType; entityId: string; name: string; spaceId?: string },
  ) {
    if (!HOST_ENTITY_TYPES.includes(input.entityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    const space = input.spaceId
      ? await this.spaceAccess.getVisibleSpace(user, input.spaceId)
      : await this.ensureHostSpace();
    // Host system space is visible to all authenticated users (same as personal).
    if (!space.isSystem) {
      await this.spaceAccess.assertCanManageSpace(user, space.id);
    } else if (input.spaceId) {
      await this.spaceAccess.getVisibleSpace(user, space.id);
    }

    const list = await this.resolver.ensureEntityList({
      spaceId: space.id,
      systemKey: systemKeyFor(input.entityType, input.entityId),
      name: input.name.trim(),
      domainEntityId: input.entityId,
    });
    return { spaceId: space.id, list, entityType: input.entityType, entityId: input.entityId };
  }

  async getEntityBundle(user: AuthUser, entityType: string, entityId: string) {
    if (!HOST_ENTITY_TYPES.includes(entityType as HostEntityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    const hostSpace = await this.ensureHostSpace();
    await this.spaceAccess.getVisibleSpace(user, hostSpace.id);
    const list = await this.prisma.taskList.findFirst({
      where: {
        spaceId: hostSpace.id,
        systemKey: systemKeyFor(entityType, entityId),
        isArchived: false,
      },
    });
    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        OR: [
          { domainEntityType: entityType, domainEntityId: entityId },
          ...(list ? [{ listId: list.id }] : []),
        ],
      },
      orderBy: { position: 'asc' },
      include: { assignees: true },
      take: 200,
    });
    return {
      entityType,
      entityId,
      list,
      tasks,
    };
  }

  async attachDomainToTask(
    taskId: string,
    domain: { domainEntityType: string; domainEntityId: string; domainLabel: string },
  ) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        domainEntityType: domain.domainEntityType,
        domainEntityId: domain.domainEntityId,
        domainLabel: domain.domainLabel,
      },
    });
  }
}
