import { Injectable } from '@nestjs/common';
import { FavoriteEntityType, Prisma, TaskGroupBy, TaskViewType } from '@prisma/client';
import { POSITION_STEP } from '../../common/constants';
import { AppError } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TaskSpaceAccessService } from '../access/task-space-access.service';

function asJsonInput(value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.DbNull;
  return value as Prisma.InputJsonValue;
}

@Injectable()
export class TaskViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly spaces: TaskSpaceAccessService,
  ) {}

  async getPreference(user: AuthUser, listId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) throw AppError.notFound();
    await this.spaces.getVisibleSpace(user, list.spaceId);
    return this.prisma.taskViewPreference.findUnique({
      where: { userId_listId: { userId: user.id, listId } },
    });
  }

  async upsertPreference(
    user: AuthUser,
    input: {
      listId: string;
      viewType?: TaskViewType;
      groupBy?: TaskGroupBy;
      sort?: unknown;
      filters?: unknown;
    },
  ) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: input.listId, isArchived: false },
    });
    if (!list) throw AppError.notFound();
    await this.spaces.getVisibleSpace(user, list.spaceId);
    return this.prisma.taskViewPreference.upsert({
      where: { userId_listId: { userId: user.id, listId: input.listId } },
      create: {
        userId: user.id,
        listId: input.listId,
        viewType: input.viewType ?? TaskViewType.LIST,
        groupBy: input.groupBy ?? TaskGroupBy.NONE,
        sort: asJsonInput(input.sort),
        filters: asJsonInput(input.filters),
      },
      update: {
        viewType: input.viewType,
        groupBy: input.groupBy,
        sort: asJsonInput(input.sort),
        filters: asJsonInput(input.filters),
      },
    });
  }

  async listViews(user: AuthUser, listId: string) {
    const list = await this.prisma.taskList.findFirst({ where: { id: listId, isArchived: false } });
    if (!list) throw AppError.notFound();
    await this.spaces.getVisibleSpace(user, list.spaceId);
    return this.prisma.taskView.findMany({
      where: {
        listId,
        OR: [{ isShared: true }, { ownerId: user.id }],
      },
      orderBy: { position: 'asc' },
    });
  }

  async createView(
    user: AuthUser,
    input: {
      listId: string;
      name: string;
      viewType: TaskViewType;
      groupBy?: TaskGroupBy;
      isShared?: boolean;
      filters?: unknown;
    },
  ) {
    const list = await this.prisma.taskList.findFirst({
      where: { id: input.listId, isArchived: false },
    });
    if (!list) throw AppError.notFound();
    await this.spaces.getVisibleSpace(user, list.spaceId);
    const isShared = input.isShared ?? false;
    if (isShared) {
      await this.spaces.assertCanManageSpace(user, list.spaceId);
    }
    const last = await this.prisma.taskView.findFirst({
      where: { listId: input.listId },
      orderBy: { position: 'desc' },
    });
    return this.prisma.taskView.create({
      data: {
        listId: input.listId,
        ownerId: user.id,
        name: input.name.trim(),
        viewType: input.viewType,
        groupBy: input.groupBy ?? TaskGroupBy.NONE,
        isShared,
        filters: asJsonInput(input.filters),
        position: (last?.position ?? 0) + POSITION_STEP,
      },
    });
  }

  async updateView(
    user: AuthUser,
    viewId: string,
    input: {
      name?: string;
      viewType?: TaskViewType;
      groupBy?: TaskGroupBy;
      isShared?: boolean;
      filters?: unknown;
    },
  ) {
    const view = await this.prisma.taskView.findUnique({ where: { id: viewId } });
    if (!view) throw AppError.notFound();
    const list = await this.prisma.taskList.findFirst({
      where: { id: view.listId, isArchived: false },
    });
    if (!list) throw AppError.notFound();
    await this.assertCanEditView(user, view, list.spaceId);
    if (input.isShared === true) {
      await this.spaces.assertCanManageSpace(user, list.spaceId);
    }
    return this.prisma.taskView.update({
      where: { id: viewId },
      data: {
        name: input.name?.trim(),
        viewType: input.viewType,
        groupBy: input.groupBy,
        isShared: input.isShared,
        filters: asJsonInput(input.filters),
      },
    });
  }

  async deleteView(user: AuthUser, viewId: string) {
    const view = await this.prisma.taskView.findUnique({ where: { id: viewId } });
    if (!view) throw AppError.notFound();
    const list = await this.prisma.taskList.findFirst({
      where: { id: view.listId, isArchived: false },
    });
    if (!list) throw AppError.notFound();
    await this.assertCanEditView(user, view, list.spaceId);
    await this.prisma.taskView.delete({ where: { id: viewId } });
    return { ok: true };
  }

  private async assertCanEditView(
    user: AuthUser,
    view: { ownerId: string },
    spaceId: string,
  ): Promise<void> {
    if (view.ownerId === user.id) {
      await this.spaces.getVisibleSpace(user, spaceId);
      return;
    }
    await this.spaces.assertCanManageSpace(user, spaceId);
  }

  async listFavorites(user: AuthUser) {
    return this.prisma.userFavorite.findMany({
      where: { userId: user.id },
      orderBy: { position: 'asc' },
    });
  }

  async addFavorite(user: AuthUser, entityType: FavoriteEntityType, entityId: string) {
    const last = await this.prisma.userFavorite.findFirst({
      where: { userId: user.id },
      orderBy: { position: 'desc' },
    });
    return this.prisma.userFavorite.upsert({
      where: {
        userId_entityType_entityId: { userId: user.id, entityType, entityId },
      },
      create: {
        userId: user.id,
        entityType,
        entityId,
        position: (last?.position ?? 0) + POSITION_STEP,
      },
      update: {},
    });
  }

  async removeFavorite(user: AuthUser, entityType: FavoriteEntityType, entityId: string) {
    await this.prisma.userFavorite.deleteMany({
      where: { userId: user.id, entityType, entityId },
    });
    return { ok: true };
  }
}
