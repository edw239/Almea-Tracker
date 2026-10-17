import { Body, Controller, Delete, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import {
  CreateListStatusDto,
  DeleteListStatusDto,
  UpdateListStatusDto,
} from './dto/list-status.dto';
import { TaskListStatusesAdminService } from './services/task-list-statuses-admin.service';

@ApiTags('statuses')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TaskListStatusesController {
  constructor(private readonly statuses: TaskListStatusesAdminService) {}

  @Post('task-lists/:listId/statuses')
  create(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Body() body: CreateListStatusDto,
  ) {
    return this.statuses.createForList(user, listId, body);
  }

  @Patch('task-list-statuses/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateListStatusDto,
  ) {
    return this.statuses.update(user, id, body);
  }

  @Delete('task-list-statuses/:id')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: DeleteListStatusDto,
  ) {
    return this.statuses.remove(user, id, body.reassignToStatusId);
  }
}
