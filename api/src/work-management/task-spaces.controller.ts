import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { CreateFolderDto, CreateListDto, CreateSpaceDto } from './dto/space.dto';
import { TaskSpacesService } from './services/task-spaces.service';

@ApiTags('spaces')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TaskSpacesController {
  constructor(private readonly spaces: TaskSpacesService) {}

  @Get('task-spaces')
  list(@CurrentUser() user: AuthUser) {
    return this.spaces.listTree(user);
  }

  @Post('task-spaces')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateSpaceDto) {
    return this.spaces.createSpace(user, dto.name, dto.description);
  }

  @Get('task-spaces/:spaceId')
  get(@CurrentUser() user: AuthUser, @Param('spaceId', ParseUUIDPipe) spaceId: string) {
    return this.spaces.getSpace(user, spaceId);
  }

  @Post('task-spaces/:spaceId/folders')
  createFolder(
    @CurrentUser() user: AuthUser,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateFolderDto,
  ) {
    return this.spaces.createFolder(user, spaceId, dto.name);
  }

  @Post('task-spaces/:spaceId/lists')
  createList(
    @CurrentUser() user: AuthUser,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() dto: CreateListDto,
  ) {
    return this.spaces.createList(user, spaceId, dto.name, dto.folderId);
  }
}
