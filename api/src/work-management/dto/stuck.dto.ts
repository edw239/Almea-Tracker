import { IsString, MaxLength, MinLength } from 'class-validator';
import { STUCK_REASON_MAX_LENGTH } from '../../common/constants';

export class MarkStuckDto {
  @IsString()
  @MinLength(1)
  @MaxLength(STUCK_REASON_MAX_LENGTH)
  reason!: string;
}
