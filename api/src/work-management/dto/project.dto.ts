import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  PROJECT_CONTRIBUTORS_MAX,
  PROJECT_NAME_MAX_LENGTH,
  PROJECT_TEXT_MAX_LENGTH,
} from '../../common/constants';
import { PROJECT_WORK_STATUSES, type ProjectWorkStatus } from '../utils/project-rules.util';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function trimToNull({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export class CreateProjectDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(PROJECT_NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(PROJECT_TEXT_MAX_LENGTH)
  outcome?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(DATE_ONLY)
  startDate?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(DATE_ONLY)
  targetEndDate?: string | null;

  @IsOptional()
  @IsIn([...PROJECT_WORK_STATUSES])
  status?: ProjectWorkStatus;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  leadUserId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sponsorUserId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PROJECT_CONTRIBUTORS_MAX)
  @IsUUID('4', { each: true })
  contributorIds?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(PROJECT_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @MaxLength(PROJECT_TEXT_MAX_LENGTH)
  outcome?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(DATE_ONLY)
  startDate?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @IsString()
  @Matches(DATE_ONLY)
  targetEndDate?: string | null;

  @IsOptional()
  @IsIn([...PROJECT_WORK_STATUSES])
  status?: ProjectWorkStatus;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  leadUserId?: string | null;

  @IsOptional()
  @Transform(trimToNull)
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  sponsorUserId?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(PROJECT_CONTRIBUTORS_MAX)
  @IsUUID('4', { each: true })
  contributorIds?: string[];
}

export class CloseProjectDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(PROJECT_TEXT_MAX_LENGTH)
  closeNote!: string;
}
