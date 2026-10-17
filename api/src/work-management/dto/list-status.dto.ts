import { TaskStatus } from '@prisma/client';
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

export class CreateListStatusDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(4)
  @MaxLength(20)
  color!: string;

  @IsEnum(TaskStatus)
  category!: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  order?: number;
}

export class UpdateListStatusDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(20)
  color?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  category?: TaskStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  order?: number;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class DeleteListStatusDto {
  @IsOptional()
  @IsUUID()
  reassignToStatusId?: string;
}
