import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors';
import type { AuthUser } from './jwt.strategy';

@Injectable()
export class GlobalAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (request.user?.role !== 'GLOBAL_ADMIN') {
      throw AppError.forbidden();
    }
    return true;
  }
}
