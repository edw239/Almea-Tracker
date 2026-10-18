import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { BoardCardColor, BoardSwimlane, BoardType } from '@prisma/client';
import {
  Allow,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { LabelsService } from '../services/labels.service';
import { BoardReportsService } from './board-reports.service';
import { BoardsService } from './boards.service';
import { SprintsService } from './sprints.service';

class SourceDto {
  @IsOptional()
  @IsUUID()
  spaceId?: string;

  @IsOptional()
  @IsUUID()
  folderId?: string;

  @IsOptional()
  @IsUUID()
  listId?: string;
}

class CreateBoardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsEnum(BoardType)
  type!: BoardType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SourceDto)
  sources!: SourceDto[];

  @IsOptional()
  filter?: unknown;

  @IsOptional()
  @IsEnum(BoardSwimlane)
  swimlaneBy?: BoardSwimlane;

  @IsOptional()
  @IsUUID()
  defaultListId?: string;
}

class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  filter?: unknown;

  @IsOptional()
  @IsEnum(BoardSwimlane)
  swimlaneBy?: BoardSwimlane;

  @IsOptional()
  swimlaneQueries?: unknown;

  @IsOptional()
  @IsBoolean()
  backlogEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  doneHideDays?: number | null;

  @IsOptional()
  @IsUUID()
  defaultListId?: string | null;

  @IsOptional()
  @IsEnum(BoardCardColor)
  cardColorBy?: BoardCardColor;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  cardFields?: string[] | null;
}

class ColumnDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsArray()
  @IsString({ each: true })
  statusNames!: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  minWip?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  maxWip?: number | null;
}

class ReplaceColumnsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ColumnDto)
  columns!: ColumnDto[];
}

class QuickFilterDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @Allow()
  filter!: unknown;
}

class MoveCardDto {
  @IsUUID()
  columnId!: string;

  @IsOptional()
  @IsString()
  laneKey?: string;

  @IsOptional()
  @IsUUID()
  beforeId?: string | null;

  @IsOptional()
  @IsUUID()
  afterId?: string | null;

  @IsOptional()
  @IsString()
  dueDate?: string | null;
}

class CreateCardDto {
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  title!: string;

  @IsOptional()
  @IsUUID()
  listId?: string;
}

class CreateSprintDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  goal?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

class StartSprintDto {
  @IsOptional()
  @IsBoolean()
  confirmMissingDue?: boolean;
}

class CompleteSprintDto {
  @IsString()
  unfinishedTo!: 'backlog' | 'sprint';

  @IsOptional()
  @IsUUID()
  sprintId?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSprintDto)
  createSprint?: CreateSprintDto;
}

class LabelDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  name!: string;
}

@ApiTags('boards')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class BoardsController {
  constructor(
    private readonly boards: BoardsService,
    private readonly sprints: SprintsService,
    private readonly reports: BoardReportsService,
  ) {}

  @Get('boards')
  list(@CurrentUser() user: AuthUser) {
    return this.boards.list(user);
  }

  @Post('boards')
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateBoardDto) {
    return this.boards.create(user, dto);
  }

  @Get('boards/:boardId')
  get(@CurrentUser() user: AuthUser, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.boards.get(user, boardId);
  }

  @Patch('boards/:boardId')
  update(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boards.update(user, boardId, dto);
  }

  @Delete('boards/:boardId')
  archive(@CurrentUser() user: AuthUser, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.boards.archive(user, boardId);
  }

  @Get('boards/:boardId/view')
  view(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('q') q?: string,
    @Query('mine') mine?: string,
    @Query('recent') recent?: string,
    @Query('quick') quick?: string,
    @Query('assigneeId') assigneeId?: string,
  ) {
    return this.boards.view(user, boardId, {
      q,
      mine: mine === '1' || mine === 'true',
      recent: recent === '1' || recent === 'true',
      quick,
      assigneeId,
    });
  }

  @Put('boards/:boardId/columns')
  replaceColumns(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: ReplaceColumnsDto,
  ) {
    return this.boards.replaceColumns(user, boardId, dto.columns);
  }

  @Post('boards/:boardId/quick-filters')
  addQuickFilter(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: QuickFilterDto,
  ) {
    return this.boards.addQuickFilter(user, boardId, dto);
  }

  @Delete('boards/:boardId/quick-filters/:filterId')
  removeQuickFilter(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('filterId', ParseUUIDPipe) filterId: string,
  ) {
    return this.boards.removeQuickFilter(user, boardId, filterId);
  }

  @Post('boards/:boardId/cards')
  createCard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.boards.createCard(user, boardId, dto.title);
  }

  @Post('boards/:boardId/cards/:taskId/move')
  moveCard(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: MoveCardDto,
  ) {
    return this.boards.moveCard(user, boardId, taskId, dto);
  }

  @Get('boards/:boardId/backlog')
  backlog(@CurrentUser() user: AuthUser, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.boards.backlog(user, boardId);
  }

  @Post('boards/:boardId/backlog/tasks')
  createBacklogTask(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateCardDto,
  ) {
    return this.boards.createBacklogTask(user, boardId, dto);
  }

  @Get('boards/:boardId/sprints')
  listSprints(@CurrentUser() user: AuthUser, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.sprints.list(user, boardId);
  }

  @Post('boards/:boardId/sprints')
  createSprint(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprints.create(user, boardId, dto);
  }

  @Post('sprints/:sprintId/start')
  startSprint(
    @CurrentUser() user: AuthUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: StartSprintDto,
  ) {
    return this.sprints.start(user, sprintId, Boolean(dto.confirmMissingDue));
  }

  @Post('sprints/:sprintId/complete')
  completeSprint(
    @CurrentUser() user: AuthUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: CompleteSprintDto,
  ) {
    return this.sprints.complete(user, sprintId, dto);
  }

  @Patch('sprints/:sprintId')
  updateSprint(
    @CurrentUser() user: AuthUser,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprints.update(user, sprintId, dto);
  }

  @Get('boards/:boardId/reports/burndown')
  burndown(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('sprintId') sprintId?: string,
    @Query('metric') metric?: string,
  ) {
    return this.reports.burndown(user, boardId, sprintId, metric === 'count' ? 'count' : 'points');
  }

  @Get('boards/:boardId/reports/sprint')
  sprintReport(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('sprintId') sprintId?: string,
  ) {
    return this.reports.sprintReport(user, boardId, sprintId);
  }

  @Get('boards/:boardId/reports/velocity')
  velocity(@CurrentUser() user: AuthUser, @Param('boardId', ParseUUIDPipe) boardId: string) {
    return this.reports.velocityReport(user, boardId);
  }

  @Get('boards/:boardId/reports/cfd')
  cfd(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('days') days?: string,
  ) {
    return this.reports.cfd(user, boardId, days ? Number(days) : undefined);
  }

  @Get('boards/:boardId/reports/cycle')
  cycle(
    @CurrentUser() user: AuthUser,
    @Param('boardId', ParseUUIDPipe) boardId: string,
    @Query('days') days?: string,
  ) {
    return this.reports.cycle(user, boardId, days ? Number(days) : undefined);
  }

}

@ApiTags('labels')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class LabelsController {
  constructor(private readonly labels: LabelsService) {}

  @Get('labels')
  search(@CurrentUser() user: AuthUser, @Query('query') query?: string) {
    return this.labels.search(user, query);
  }

  @Post('labels')
  create(@CurrentUser() user: AuthUser, @Body() dto: LabelDto) {
    return this.labels.create(user, dto.name);
  }
}
