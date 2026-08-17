import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { TEMPLATE_NAME_MAX_LENGTH } from '../common/constants';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { TaskTemplatesService } from './services/task-templates.service';

class CreateTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TEMPLATE_NAME_MAX_LENGTH)
  name!: string;

  @IsArray()
  items!: unknown[];

  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsUUID()
  listId?: string;
}

@ApiTags('templates')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class TaskTemplatesController {
  constructor(private readonly templates: TaskTemplatesService) {}

  @Get('task-lists/:listId/templates')
  listForList(@CurrentUser() user: AuthUser, @Param('listId', ParseUUIDPipe) listId: string) {
    return this.templates.listForList(user, listId);
  }

  @Post('task-templates')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTemplateDto) {
    return this.templates.create(user, dto);
  }

  @Post('task-lists/:listId/tasks/from-template/:templateId')
  expand(
    @CurrentUser() user: AuthUser,
    @Param('listId', ParseUUIDPipe) listId: string,
    @Param('templateId', ParseUUIDPipe) templateId: string,
  ) {
    return this.templates.expandIntoList(user, listId, templateId);
  }
}
