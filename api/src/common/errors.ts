import { HttpException, HttpStatus } from '@nestjs/common';

export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  MUST_CHANGE_PASSWORD: 'MUST_CHANGE_PASSWORD',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TASK_DELEGATION_REQUIRES_DUE_DATE: 'TASK_DELEGATION_REQUIRES_DUE_DATE',
  TASK_REVIEW_BLOCKS_DONE: 'TASK_REVIEW_BLOCKS_DONE',
  BOARD_COLUMN_UNAVAILABLE: 'BOARD_COLUMN_UNAVAILABLE',
  SPRINT_ALREADY_ACTIVE: 'SPRINT_ALREADY_ACTIVE',
  SPRINT_START_NEEDS_DUE: 'SPRINT_START_NEEDS_DUE',
  SPACE_KEY_INVALID: 'SPACE_KEY_INVALID',
  SPACE_KEY_TAKEN: 'SPACE_KEY_TAKEN',
  LABEL_MATCHES_BRAND: 'LABEL_MATCHES_BRAND',
  EPIC_INVALID: 'EPIC_INVALID',
  RANK_ORDER: 'RANK_ORDER',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends HttpException {
  readonly code: ErrorCodeValue;

  constructor(
    code: ErrorCodeValue,
    message: string,
    status: HttpStatus,
    details?: Record<string, unknown>,
  ) {
    super(details ? { code, message, ...details } : { code, message }, status);
    this.code = code;
  }

  static unauthorized(message = 'Требуется вход'): AppError {
    return new AppError(ErrorCode.UNAUTHORIZED, message, HttpStatus.UNAUTHORIZED);
  }

  static forbidden(message = 'Недостаточно прав'): AppError {
    return new AppError(ErrorCode.FORBIDDEN, message, HttpStatus.FORBIDDEN);
  }

  static mustChangePassword(message = 'Сначала смените временный пароль'): AppError {
    return new AppError(ErrorCode.MUST_CHANGE_PASSWORD, message, HttpStatus.FORBIDDEN);
  }

  static notFound(message = 'Не найдено'): AppError {
    return new AppError(ErrorCode.NOT_FOUND, message, HttpStatus.NOT_FOUND);
  }

  static conflict(message: string): AppError {
    return new AppError(ErrorCode.CONFLICT, message, HttpStatus.CONFLICT);
  }

  static badRequest(message: string): AppError {
    return new AppError(ErrorCode.VALIDATION_FAILED, message, HttpStatus.BAD_REQUEST);
  }
}
