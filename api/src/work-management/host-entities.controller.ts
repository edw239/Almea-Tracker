import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { CreateHostEntityDto, UpdateHostEntityDto } from './dto/host-entity.dto';
import { HostEntitiesService } from './services/host-entities.service';

@ApiTags('host-entities')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('host-entities')
export class HostEntitiesController {
  constructor(private readonly entities: HostEntitiesService) {}

  @Get()
  list(
    @Query('type') type?: string,
    @Query('query') query?: string,
    @Query('includeArchived') includeArchived?: string,
    @Query('limit') limitRaw?: string,
    @Query('visibleOnly') visibleOnly?: string,
  ) {
    const limit = limitRaw ? Number(limitRaw) : undefined;
    return this.entities.list({
      type,
      query,
      includeArchived: includeArchived === 'true' || includeArchived === '1',
      limit: Number.isFinite(limit) ? limit : undefined,
      visibleOnly: visibleOnly !== 'false' && visibleOnly !== '0',
    });
  }

  @Post()
  create(@Body() dto: CreateHostEntityDto) {
    return this.entities.create(dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.entities.getById(user, id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateHostEntityDto) {
    return this.entities.update(id, dto);
  }
}
