import { Injectable, type ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AppError } from '../../common/errors';
import { isAllowedWhileMustChangePassword } from '../utils/must-change-password';
import type { AuthUser } from './jwt.strategy';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(err: unknown, user: TUser, _info: unknown, context: ExecutionContext): TUser {
    if (err || !user) {
      throw err instanceof AppError ? err : AppError.unauthorized();
    }
    const actor = user as unknown as AuthUser;
    if (actor.mustChangePassword) {
      const req = context.switchToHttp().getRequest<{ method: string; originalUrl?: string; url: string }>();
      const url = req.originalUrl ?? req.url;
      if (!isAllowedWhileMustChangePassword(req.method, url)) {
        throw AppError.mustChangePassword();
      }
    }
    return user;
  }
}
