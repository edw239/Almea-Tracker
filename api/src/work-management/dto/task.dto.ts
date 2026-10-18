import { TaskPriority, TaskStatus } from '@prisma/client';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from 'class-validator';
import { STORY_POINTS_MAX, TITLE_MAX_LENGTH } from '../../common/constants';

export class CreateTaskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsBoolean()
  reviewRequired?: boolean;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  hostEntityId?: string | null;

  @IsOptional()
  @IsUUID()
  listStatusId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  taskTypeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  epicId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(STORY_POINTS_MAX)
  storyPoints?: number | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sprintId?: string | null;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  description?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  listStatusId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @IsOptional()
  @IsBoolean()
  reviewRequired?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewRejectReason?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(120)
  domainEntityId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(40)
  domainEntityType?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(200)
  domainLabel?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  hostEntityId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  taskTypeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  epicId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsNumber()
  @Min(0)
  @Max(STORY_POINTS_MAX)
  storyPoints?: number | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  labelIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sprintId?: string | null;
}

export class MoveTaskDto {
  @IsOptional()
  @IsUUID()
  listId?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  listStatusId?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  afterTaskId?: string | null;

  @IsOptional()
  @IsNumber()
  position?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reviewRejectReason?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  rankBeforeId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  rankAfterId?: string | null;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  epicId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  hostEntityId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  dueDate?: string | null;
}

export class BulkUpdateTasksDto {
  @IsUUID('4', { each: true })
  taskIds!: string[];

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  listStatusId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}
