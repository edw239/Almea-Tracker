import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { BulkUpdateTasksDto, CreateTaskDto, MoveTaskDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './services/tasks.service';

@ApiTags('tasks')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('tasks')
  myWork(@CurrentUser() user: AuthUser) {
    return this.tasks.myWork(user);
  }

  @Get('tasks/overdue')
  overdue(@CurrentUser() user: AuthUser) {
    return this.tasks.overdue(user);
  }

  @Get('tasks/kanban')
  kanban(@CurrentUser() user: AuthUser, @Query('listId', ParseUUIDPipe) listId: string) {
    return this.tasks.kanban(user, listId);
  }

  @Patch('tasks/bulk')
  bulk(@CurrentUser() user: AuthUser, @Body() dto: BulkUpdateTasksDto) {
    return this.tasks.bulkUpdate(user, dto);
  }

  @Get('tasks/:taskId')
  get(@CurrentUser() user: AuthUser, @Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.tasks.getById(user, taskId);
  }

  @Patch('tasks/:taskId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(user, taskId, dto);
  }

  @Patch('tasks/:taskId/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: MoveTaskDto,
  ) {
    return this.tasks.move(user, taskId, dto);
  }

  @Get('task-lists/:listId/tasks')
  listTasks(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Query('filters') filters?: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tasks.listByList(user, listId, {
      filters,
      cursor,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post('task-lists/:listId/tasks')
  createInList(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.createInList(user, listId, dto);
  }

  @Get('task-lists/:listId/statuses')
  listStatuses(@CurrentUser() user: AuthUser, @Param('listId', ParseUUIDPipe) listId: string) {
    return this.tasks.statusesForList(user, listId);
  }
}
