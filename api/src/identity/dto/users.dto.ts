import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';
import { JOB_TITLE_MAX_LENGTH, NAME_MAX_LENGTH } from '../../common/constants';

function trimString(value: unknown): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateUserDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail()
  email!: string;

  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  name!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : trimString(value)))
  @IsString()
  @MaxLength(JOB_TITLE_MAX_LENGTH)
  jobTitle?: string | null;
}

export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }) => trimString(value))
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? null : trimString(value)))
  @IsString()
  @MaxLength(JOB_TITLE_MAX_LENGTH)
  jobTitle?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
