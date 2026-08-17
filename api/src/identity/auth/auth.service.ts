import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { CookieOptions, Response } from 'express';
import { AppError } from '../../common/errors';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_COOKIE_NAME, AUTH_COOKIE_PATH, parseDurationToSeconds } from './auth.constants';
import type { AuthUser, JwtPayload } from './jwt.strategy';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      throw AppError.unauthorized('Неверный email или пароль');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw AppError.unauthorized('Неверный email или пароль');
    }
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  }

  async signSession(user: AuthUser): Promise<string> {
    const payload: JwtPayload = { sub: user.id, email: user.email };
    return this.jwt.signAsync(payload);
  }

  attachSessionCookie(res: Response, token: string): void {
    res.cookie(AUTH_COOKIE_NAME, token, this.cookieOptions());
  }

  clearSessionCookie(res: Response): void {
    res.clearCookie(AUTH_COOKIE_NAME, this.cookieOptions());
  }

  private cookieOptions(): CookieOptions {
    const ttlSeconds = parseDurationToSeconds(this.config.get('JWT_EXPIRES_IN', { infer: true }));
    const isProd = this.config.get('NODE_ENV', { infer: true }) === 'production';
    // Static UI and API are on different onrender.com hosts — Lax would drop the cookie.
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      path: AUTH_COOKIE_PATH,
      maxAge: ttlSeconds * 1000,
    };
  }
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
