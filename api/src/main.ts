import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import type { Env } from './config/env';
import { AUTH_COOKIE_NAME } from './identity/auth/auth.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<Env, true>);
  const port = config.get('PORT', { infer: true });
  const webOrigin = config.get('WEB_ORIGIN', { infer: true });

  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.enableCors({
    origin: webOrigin.split(',').map((item) => item.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swagger = new DocumentBuilder()
    .setTitle('Almea Tracker API')
    .setDescription('Work Management core. Host domain is a plugin, not a tree branch.')
    .setVersion('0.1.0')
    .addCookieAuth(AUTH_COOKIE_NAME)
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));

  await app.listen(port);
}

void bootstrap();
