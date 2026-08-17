import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { loadEnv } from './config/env';
import { HealthController } from './health.controller';
import { IdentityModule } from './identity/identity.module';
import { PrismaModule } from './prisma/prisma.module';
import { WorkManagementModule } from './work-management/work-management.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (source) => loadEnv(source),
    }),
    PrismaModule,
    IdentityModule,
    WorkManagementModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
