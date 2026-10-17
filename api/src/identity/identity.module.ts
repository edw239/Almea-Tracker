import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import type { Env } from '../config/env';
import { parseDurationToSeconds } from './auth/auth.constants';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { JwtStrategy } from './auth/jwt.strategy';
import { MeController } from './me.controller';
import { MeService } from './me.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_SECRET', { infer: true }),
        signOptions: {
          expiresIn: parseDurationToSeconds(config.get('JWT_EXPIRES_IN', { infer: true })),
        },
      }),
    }),
  ],
  controllers: [AuthController, UsersController, MeController],
  providers: [AuthService, JwtStrategy, UsersService, MeService],
  exports: [AuthService],
})
export class IdentityModule {}
