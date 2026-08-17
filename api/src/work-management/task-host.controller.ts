import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { HOST_ENTITY_TYPES, type HostEntityType } from '../common/constants';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { TaskHostService } from './services/task-host.service';

class EnsureEntityListDto {
  @IsIn([...HOST_ENTITY_TYPES])
  entityType!: HostEntityType;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  entityId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsUUID()
  spaceId?: string;
}

@ApiTags('host')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('host')
export class TaskHostController {
  constructor(private readonly host: TaskHostService) {}

  @Post('entity-lists/ensure')
  ensure(@CurrentUser() user: AuthUser, @Body() dto: EnsureEntityListDto) {
    return this.host.ensureEntityList(user, dto);
  }

  @Get('entities/:entityType/:entityId')
  getEntity(
    @CurrentUser() user: AuthUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.host.getEntityBundle(user, entityType, entityId);
  }
}
