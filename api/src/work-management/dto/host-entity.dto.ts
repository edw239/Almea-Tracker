import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  HOST_ENTITY_NAME_MAX_LENGTH,
  HOST_ENTITY_TYPES,
  type HostEntityType,
} from '../../common/constants';

export class CreateHostEntityDto {
  @IsIn([...HOST_ENTITY_TYPES])
  entityType!: HostEntityType;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(HOST_ENTITY_NAME_MAX_LENGTH)
  name!: string;
}

export class UpdateHostEntityDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(HOST_ENTITY_NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsBoolean()
  isArchived?: boolean;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(100)
  externalKey?: string | null;
}
