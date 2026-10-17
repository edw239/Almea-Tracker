import { Injectable } from '@nestjs/common';
import {
  HOST_ENTITIES_PAGE_DEFAULT,
  HOST_ENTITIES_PAGE_MAX,
  HOST_ENTITY_TYPES,
  HOST_ENTITY_TYPES_VISIBLE,
  type HostEntityType,
} from '../../common/constants';
import { AppError } from '../../common/errors';
import { isPrismaUniqueConflict } from '../../common/prisma-errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';
import {
  normalizeHostEntityDisplayName,
  normalizeHostEntityNameKey,
} from '../utils/host-entity-name.util';

const PUBLIC_SELECT = {
  id: true,
  entityType: true,
  name: true,
  nameKey: true,
  externalKey: true,
  isArchived: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class HostEntitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaceAccess: TaskSpaceAccessService,
  ) {}

  list(opts: {
    type?: string;
    query?: string;
    includeArchived?: boolean;
    limit?: number;
    visibleOnly?: boolean;
  }) {
    const entityType = opts.type;
    if (entityType && !HOST_ENTITY_TYPES.includes(entityType as HostEntityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    if (opts.visibleOnly && entityType && !HOST_ENTITY_TYPES_VISIBLE.includes(entityType as (typeof HOST_ENTITY_TYPES_VISIBLE)[number])) {
      return [];
    }
    const limit = Math.min(
      Math.max(opts.limit ?? HOST_ENTITIES_PAGE_DEFAULT, 1),
      HOST_ENTITIES_PAGE_MAX,
    );
    const nameKeyQuery = opts.query?.trim()
      ? normalizeHostEntityNameKey(opts.query)
      : undefined;
    const typeFilter =
      opts.visibleOnly && !entityType
        ? { entityType: { in: [...HOST_ENTITY_TYPES_VISIBLE] } }
        : entityType
          ? { entityType }
          : {};

    return this.prisma.hostEntity.findMany({
      where: {
        ...typeFilter,
        ...(opts.includeArchived ? {} : { isArchived: false }),
        ...(nameKeyQuery ? { nameKey: { contains: nameKeyQuery } } : {}),
      },
      select: PUBLIC_SELECT,
      orderBy: [{ name: 'asc' }],
      take: limit,
    });
  }

  async create(dto: { entityType: HostEntityType; name: string }) {
    if (!HOST_ENTITY_TYPES.includes(dto.entityType)) {
      throw AppError.badRequest('Неизвестный entityType');
    }
    let name: string;
    try {
      name = normalizeHostEntityDisplayName(dto.name);
    } catch {
      throw AppError.badRequest('Некорректное имя сущности');
    }
    const nameKey = normalizeHostEntityNameKey(name);
    try {
      return await this.prisma.hostEntity.create({
        data: {
          entityType: dto.entityType,
          name,
          nameKey,
        },
        select: PUBLIC_SELECT,
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw AppError.conflict('Сущность с таким именем уже есть');
      }
      throw error;
    }
  }

  async update(id: string, dto: { name?: string; isArchived?: boolean; externalKey?: string | null }) {
    if (dto.name === undefined && dto.isArchived === undefined && dto.externalKey === undefined) {
      throw AppError.badRequest('Нет полей для обновления');
    }
    const existing = await this.prisma.hostEntity.findUnique({ where: { id } });
    if (!existing) {
      throw AppError.notFound();
    }
    let name = existing.name;
    let nameKey = existing.nameKey;
    if (dto.name !== undefined) {
      try {
        name = normalizeHostEntityDisplayName(dto.name);
      } catch {
        throw AppError.badRequest('Некорректное имя сущности');
      }
      nameKey = normalizeHostEntityNameKey(name);
    }
    try {
      return await this.prisma.hostEntity.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name, nameKey } : {}),
          ...(dto.isArchived !== undefined ? { isArchived: dto.isArchived } : {}),
          ...(dto.externalKey !== undefined ? { externalKey: dto.externalKey || null } : {}),
        },
        select: PUBLIC_SELECT,
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw AppError.conflict('Сущность с таким именем уже есть');
      }
      throw error;
    }
  }

  async getById(user: AuthUser, id: string) {
    const entity = await this.prisma.hostEntity.findUnique({
      where: { id },
      select: PUBLIC_SELECT,
    });
    if (!entity) {
      throw AppError.notFound();
    }

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

    const list = await this.prisma.taskList.findFirst({
      where: { hostEntityId: id, isArchived: false },
      orderBy: { createdAt: 'asc' },
    });

    const tasks = await this.prisma.task.findMany({
      where: {
        deletedAt: null,
        parentTaskId: null,
        hostEntityId: id,
        ...visibility,
      },
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      take: 200,
      include: {
        assignees: true,
        list: { select: { id: true, name: true, spaceId: true } },
      },
    });

    return {
      ...entity,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      list,
      tasks,
    };
  }

  async findActive(id: string) {
    const entity = await this.prisma.hostEntity.findFirst({
      where: { id, isArchived: false },
    });
    if (!entity) {
      throw AppError.badRequest('Сущность не найдена или в архиве');
    }
    return entity;
  }

  /** Find or create by type+name; used when attaching from free-form ensure. */
  async upsertByName(entityType: HostEntityType, name: string) {
    const display = normalizeHostEntityDisplayName(name);
    const nameKey = normalizeHostEntityNameKey(display);
    const existing = await this.prisma.hostEntity.findUnique({
      where: { entityType_nameKey: { entityType, nameKey } },
    });
    if (existing) {
      return existing;
    }
    try {
      return await this.prisma.hostEntity.create({
        data: { entityType, name: display, nameKey },
      });
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        const again = await this.prisma.hostEntity.findUnique({
          where: { entityType_nameKey: { entityType, nameKey } },
        });
        if (again) return again;
      }
      throw error;
    }
  }
}
