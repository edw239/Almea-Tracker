import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/identity/auth/auth.constants';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const password = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  password.length >= 8;

(canRun ? describe : describe.skip)('Me profile (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let originalPassword = password;
  let workingPassword = password;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    agent = request.agent(app.getHttpServer());
  });

  afterAll(async () => {
    // Restore seed password if we changed it mid-suite
    if (workingPassword !== originalPassword) {
      const restore = request.agent(app.getHttpServer());
      await restore.post('/api/auth/login').send({ email, password: workingPassword });
      await restore.post('/api/me/password').send({
        currentPassword: workingPassword,
        newPassword: originalPassword,
      });
    }
    await app.close();
  });

  it('GET /me returns profile and memberships', async () => {
    await agent.post('/api/auth/login').send({ email, password: workingPassword }).expect(201);
    const me = await agent.get('/api/me').expect(200);
    expect(me.body.email).toBe(email.toLowerCase());
    expect(me.body.timezone).toBeTruthy();
    expect(Array.isArray(me.body.memberships)).toBe(true);
  });

  it('PATCH /me updates timezone and rejects garbage', async () => {
    await agent.patch('/api/me').send({ timezone: 'Not/AZone' }).expect(400);
    const ok = await agent.patch('/api/me').send({ timezone: 'Europe/Moscow', locale: 'ru' }).expect(200);
    expect(ok.body.timezone).toBe('Europe/Moscow');
  });

  it('POST /me/password rotates cookie and invalidates old JWT', async () => {
    const login = await agent.post('/api/auth/login').send({ email, password: workingPassword }).expect(201);
    const setCookie = login.headers['set-cookie'];
    const cookies = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const oldCookie = cookies.find((c) => c.startsWith(`${AUTH_COOKIE_NAME}=`));
    expect(oldCookie).toBeTruthy();

    // Ensure passwordChangedAt second is strictly after old JWT iat
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const nextPassword = `${originalPassword}-rotated`;
    // Wrong current password
    await agent
      .post('/api/me/password')
      .send({ currentPassword: 'wrong-password-xx', newPassword: nextPassword })
      .expect(401);

    const changed = await agent
      .post('/api/me/password')
      .send({ currentPassword: workingPassword, newPassword: nextPassword })
      .expect(201);
    expect(changed.body.ok).toBe(true);
    workingPassword = nextPassword;

    // Old cookie must fail (iat before passwordChangedAt)
    const stale = request.agent(app.getHttpServer());
    await stale.get('/api/me').set('Cookie', oldCookie!).expect(401);

    // New session works
    await agent.get('/api/me').expect(200);
  });
});
