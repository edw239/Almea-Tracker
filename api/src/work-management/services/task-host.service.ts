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
import { HostEntitiesService } from './host-entities.service';

export function systemKeyFor(entityType: string, entityId: string): string {
  return `entity:${entityType}:${entityId}`;
}

@Injectable()
export class TaskHostService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: TaskListResolverService,
    private readonly spaceAccess: TaskSpaceAccessService,
    private readonly hostEntities: HostEntitiesService,
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
    if (!space.isSystem) {
      await this.spaceAccess.assertCanManageSpace(user, space.id);
    } else if (input.spaceId) {
      await this.spaceAccess.getVisibleSpace(user, space.id);
    }

    const entity = await this.hostEntities.upsertByName(input.entityType, input.name.trim() || input.entityId);
    const list = await this.resolver.ensureEntityList({
      spaceId: space.id,
      systemKey: systemKeyFor(input.entityType, entity.id),
      name: entity.name,
      domainEntityId: entity.id,
      hostEntityId: entity.id,
    });
    return {
      spaceId: space.id,
      list,
      entityType: input.entityType,
      entityId: entity.id,
      hostEntity: {
        id: entity.id,
        entityType: entity.entityType,
        name: entity.name,
      },
    };
  }

  async ensureListForHostEntity(user: AuthUser, hostEntityId: string) {
    const entity = await this.hostEntities.findActive(hostEntityId);
    if (!HOST_ENTITY_TYPES.includes(entity.entityType as HostEntityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    return this.ensureEntityList(user, {
      entityType: entity.entityType as HostEntityType,
      entityId: entity.id,
      name: entity.name,
    });
  }

  async getEntityBundle(user: AuthUser, entityType: string, entityId: string) {
    if (!HOST_ENTITY_TYPES.includes(entityType as HostEntityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    // Prefer registry id (UUID); fall back to legacy string id + denormalized fields.
    const byId = await this.prisma.hostEntity.findFirst({
      where: { id: entityId, entityType },
    });
    if (byId) {
      return this.hostEntities.getById(user, byId.id);
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
    const scope = await this.spaceAccess.listVisibleSpaceIds(user);
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
        ...visibility,
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
    domain: { domainEntityType: string; domainEntityId: string; domainLabel: string; hostEntityId?: string },
  ) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        domainEntityType: domain.domainEntityType,
        domainEntityId: domain.domainEntityId,
        domainLabel: domain.domainLabel,
        hostEntityId: domain.hostEntityId ?? null,
      },
    });
  }
}
