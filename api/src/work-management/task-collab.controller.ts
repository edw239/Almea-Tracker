import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { TaskRelationType } from '@prisma/client';
import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { TaskCollabService } from './services/task-collab.service';

class CommentDto {
  @IsString()
  @MinLength(1)
  body!: string;
}

class ChecklistDto {
  @IsString()
  @MinLength(1)
  text!: string;
}

class RelationDto {
  @IsUUID()
  toTaskId!: string;

  @IsEnum(TaskRelationType)
  relationType!: TaskRelationType;
}

@ApiTags('task-collab')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks/:taskId')
export class TaskCollabController {
  constructor(private readonly collab: TaskCollabService) {}

  @Get('comments')
  comments(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.collab.listComments(user, taskId);
  }

  @Post('comments')
  addComment(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CommentDto,
  ) {
    return this.collab.addComment(user, taskId, dto.body);
  }

  @Get('checklist')
  checklist(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.collab.listChecklist(user, taskId);
  }

  @Post('checklist')
  addCheck(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: ChecklistDto,
  ) {
    return this.collab.addChecklistItem(user, taskId, dto.text);
  }

  @Patch('checklist/:itemId')
  toggleCheck(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.collab.toggleChecklistItem(user, taskId, itemId);
  }

  @Post('watchers/:userId')
  addWatcher(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.collab.addWatcher(user, taskId, userId);
  }

  @Delete('watchers/:userId')
  removeWatcher(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.collab.removeWatcher(user, taskId, userId);
  }

  @Get('relations')
  relations(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.collab.listRelations(user, taskId);
  }

  @Post('relations')
  addRelation(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: RelationDto,
  ) {
    return this.collab.addRelation(user, taskId, dto.toTaskId, dto.relationType);
  }

  @Delete('relations/:relationId')
  removeRelation(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Param('relationId', ParseUUIDPipe) relationId: string,
  ) {
    return this.collab.removeRelation(user, taskId, relationId);
  }

  @Get('activity')
  activity(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.collab.listActivity(user, taskId);
  }
}
