import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppError } from '../../common/errors';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_COOKIE_NAME } from './auth.constants';

export type JwtPayload = {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
};

function cookieExtractor(req: Request): string | null {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  return typeof token === 'string' && token.length > 0 ? token : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordChangedAt: true,
        isActive: true,
        mustChangePassword: true,
      },
    });
    if (!user || !user.isActive) {
      throw AppError.unauthorized();
    }
    if (user.passwordChangedAt && payload.iat != null) {
      // Tokens with iat before the password-change second are dead.
      // Same-second tokens (incl. the freshly issued cookie) stay valid.
      const changedAtSec = Math.floor(user.passwordChangedAt.getTime() / 1000);
      if (payload.iat < changedAtSec) {
        throw AppError.unauthorized();
      }
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
