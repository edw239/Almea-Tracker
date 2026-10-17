import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { CreateTaskScheduleDto, UpdateTaskScheduleDto } from './dto/schedule.dto';
import { TaskSchedulesService } from './services/task-schedules.service';

@ApiTags('schedules')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TaskSchedulesController {
  constructor(private readonly schedules: TaskSchedulesService) {}

  @Get('task-lists/:listId/schedules')
  list(@CurrentUser() user: AuthUser, @Param('listId', ParseUUIDPipe) listId: string) {
    return this.schedules.listForList(user, listId);
  }

  @Post('task-lists/:listId/schedules')
  create(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() body: CreateTaskScheduleDto,
  ) {
    return this.schedules.create(user, listId, body);
  }

  @Patch('task-schedules/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTaskScheduleDto,
  ) {
    return this.schedules.update(user, id, body);
  }
}
