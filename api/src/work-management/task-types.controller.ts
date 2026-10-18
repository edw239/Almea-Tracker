import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

class CreateTaskTypeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  key!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}

class UpdateTaskTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  color?: string;
}
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

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Param('spaceId', ParseUUIDPipe) spaceId: string,
    @Body() body: CreateTaskTypeDto,
  ) {
    return this.types.create(user, spaceId, body);
  }
}

@ApiTags('task-types')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('task-types')
export class TaskTypeItemController {
  constructor(private readonly types: TaskTypesService) {}

  @Patch(':typeId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('typeId', ParseUUIDPipe) typeId: string,
    @Body() body: UpdateTaskTypeDto,
  ) {
    return this.types.update(user, typeId, body);
  }

  @Delete(':typeId')
  remove(@CurrentUser() user: AuthUser, @Param('typeId', ParseUUIDPipe) typeId: string) {
    return this.types.remove(user, typeId);
  }
}
