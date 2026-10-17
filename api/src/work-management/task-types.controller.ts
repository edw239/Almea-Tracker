import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { TaskTypesService } from './services/task-types.service';

@ApiTags('task-types')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-spaces/:spaceId/task-types')
export class TaskTypesController {
  constructor(private readonly types: TaskTypesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return this.types.listForSpace(user, spaceId);
  }
}
