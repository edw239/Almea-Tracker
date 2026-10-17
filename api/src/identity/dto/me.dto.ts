import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { NotificationCode } from '@prisma/client';
import {
  JOB_TITLE_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  QUIET_HOURS_MAX,
  QUIET_HOURS_MIN,
  SNOOZE_HOURS_MAX,
  SNOOZE_HOURS_MIN,
  SUPPORTED_LOCALES,
} from '../../common/constants';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(NAME_MAX_LENGTH)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsIn([...SUPPORTED_LOCALES])
  locale?: (typeof SUPPORTED_LOCALES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(JOB_TITLE_MAX_LENGTH)
  jobTitle?: string | null;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  @MaxLength(PASSWORD_MAX_LENGTH)
  currentPassword!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(PASSWORD_MAX_LENGTH)
  newPassword!: string;
}

export class NotificationCodeSettingDto {
  @IsEnum(NotificationCode)
  code!: NotificationCode;

  @IsBoolean()
  inApp!: boolean;
}

export class PutNotificationSettingsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => NotificationCodeSettingDto)
  codes!: NotificationCodeSettingDto[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(QUIET_HOURS_MIN)
  @Max(QUIET_HOURS_MAX)
  quietHoursFrom?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(QUIET_HOURS_MIN)
  @Max(QUIET_HOURS_MAX)
  quietHoursTo?: number | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(SNOOZE_HOURS_MIN)
  @Max(SNOOZE_HOURS_MAX)
  snoozeHoursDefault?: number | null;
}
