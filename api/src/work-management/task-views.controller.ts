import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { FavoriteEntityType, TaskGroupBy, TaskViewType } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { TaskViewsService } from './services/task-views.service';

class UpsertPreferenceDto {
  @IsUUID()
  listId!: string;

  @IsOptional()
  @IsEnum(TaskViewType)
  viewType?: TaskViewType;

  @IsOptional()
  @IsEnum(TaskGroupBy)
  groupBy?: TaskGroupBy;

  @IsOptional()
  sort?: unknown;

  @IsOptional()
  filters?: unknown;
}

class CreateViewDto {
  @IsUUID()
  listId!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(TaskViewType)
  viewType!: TaskViewType;

  @IsOptional()
  @IsEnum(TaskGroupBy)
  groupBy?: TaskGroupBy;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  filters?: unknown;
}

class UpdateViewDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEnum(TaskViewType)
  viewType?: TaskViewType;

  @IsOptional()
  @IsEnum(TaskGroupBy)
  groupBy?: TaskGroupBy;

  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @IsOptional()
  filters?: unknown;
}

class FavoriteDto {
  @IsEnum(FavoriteEntityType)
  entityType!: FavoriteEntityType;

  @IsUUID()
  entityId!: string;
}

@ApiTags('views')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TaskViewsController {
  constructor(private readonly views: TaskViewsService) {}

  @Get('task-view-preferences')
  getPref(@CurrentUser() user: AuthUser, @Query('listId', ParseUUIDPipe) listId: string) {
    return this.views.getPreference(user, listId);
  }

  @Put('task-view-preferences')
  putPref(@CurrentUser() user: AuthUser, @Body() dto: UpsertPreferenceDto) {
    return this.views.upsertPreference(user, dto);
  }

  @Get('task-lists/:listId/views')
  listViews(@CurrentUser() user: AuthUser, @Param('listId', ParseUUIDPipe) listId: string) {
    return this.views.listViews(user, listId);
  }

  @Post('task-views')
  createView(@CurrentUser() user: AuthUser, @Body() dto: CreateViewDto) {
    return this.views.createView(user, dto);
  }

  @Patch('task-views/:viewId')
  updateView(
    @CurrentUser() user: AuthUser,
    @Param('viewId', ParseUUIDPipe) viewId: string,
    @Body() dto: UpdateViewDto,
  ) {
    return this.views.updateView(user, viewId, dto);
  }

  @Delete('task-views/:viewId')
  deleteView(@CurrentUser() user: AuthUser, @Param('viewId', ParseUUIDPipe) viewId: string) {
    return this.views.deleteView(user, viewId);
  }

  @Get('user-favorites')
  favorites(@CurrentUser() user: AuthUser) {
    return this.views.listFavorites(user);
  }

  @Post('user-favorites')
  addFavorite(@CurrentUser() user: AuthUser, @Body() dto: FavoriteDto) {
    return this.views.addFavorite(user, dto.entityType, dto.entityId);
  }

  @Delete('user-favorites/:entityType/:entityId')
  removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param('entityType') entityType: FavoriteEntityType,
    @Param('entityId', ParseUUIDPipe) entityId: string,
  ) {
    return this.views.removeFavorite(user, entityType, entityId);
  }
}
