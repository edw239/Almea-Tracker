import { ScheduleFrequency } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  SCHEDULE_AT_MINUTE_MAX,
  SCHEDULE_AT_MINUTE_MIN,
  SCHEDULE_MONTHDAY_MAX,
  SCHEDULE_MONTHDAY_MIN,
  SCHEDULE_TITLE_MAX_LENGTH,
  SCHEDULE_WEEKDAY_MAX,
  SCHEDULE_WEEKDAY_MIN,
} from '../../common/constants';

export class CreateTaskScheduleDto {
  @IsString()
  @MinLength(1)
  @MaxLength(SCHEDULE_TITLE_MAX_LENGTH)
  title!: string;

  @IsEnum(ScheduleFrequency)
  frequency!: ScheduleFrequency;

  @IsOptional()
  @IsInt()
  @Min(SCHEDULE_WEEKDAY_MIN)
  @Max(SCHEDULE_WEEKDAY_MAX)
  byWeekday?: number;

  @IsOptional()
  @IsInt()
  @Min(SCHEDULE_MONTHDAY_MIN)
  @Max(SCHEDULE_MONTHDAY_MAX)
  byMonthday?: number;

  @IsInt()
  @Min(SCHEDULE_AT_MINUTE_MIN)
  @Max(SCHEDULE_AT_MINUTE_MAX)
  atMinute!: number;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone!: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dueInDays?: number;
}

export class UpdateTaskScheduleDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(SCHEDULE_TITLE_MAX_LENGTH)
  title?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  assigneeUserId?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  dueInDays?: number | null;

  @IsOptional()
  @IsInt()
  @Min(SCHEDULE_AT_MINUTE_MIN)
  @Max(SCHEDULE_AT_MINUTE_MAX)
  atMinute?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsInt()
  @Min(SCHEDULE_WEEKDAY_MIN)
  @Max(SCHEDULE_WEEKDAY_MAX)
  byWeekday?: number | null;

  @IsOptional()
  @IsInt()
  @Min(SCHEDULE_MONTHDAY_MIN)
  @Max(SCHEDULE_MONTHDAY_MAX)
  byMonthday?: number | null;
}
