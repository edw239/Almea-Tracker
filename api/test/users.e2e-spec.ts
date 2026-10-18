import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/identity/auth/auth.constants';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  adminPassword.length >= 8;

(canRun ? describe : describe.skip)('People provisioning (e2e)', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  const createdIds: string[] = [];

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
    admin = request.agent(app.getHttpServer());
    await admin.post('/api/auth/login').send({ email: adminEmail, password: adminPassword }).expect(201);
  });

  afterAll(async () => {
    for (const id of createdIds) {
      await admin.patch(`/api/users/${id}`).send({ isActive: false });
    }
    await app.close();
  });

  it('member cannot create users', async () => {
    const stamp = Date.now();
    const created = await admin
      .post('/api/users')
      .send({ email: `member.${stamp}@almea.ru`, name: 'Member Probe' })
      .expect(201);
    createdIds.push(created.body.id);
    const temp = created.body.temporaryPassword as string;

    const member = request.agent(app.getHttpServer());
    await member.post('/api/auth/login').send({ email: created.body.email, password: temp }).expect(201);
    await member.post('/api/me/password').send({ currentPassword: temp, newPassword: 'member-pass-1' }).expect(201);
    await member.post('/api/users').send({ email: `blocked.${stamp}@almea.ru`, name: 'Nope' }).expect(403);
  });

  it('create → login → tasks 403 until password change → duplicate 409', async () => {
    const stamp = Date.now();
    const email = `people.${stamp}@almea.ru`;
    const logChunks: string[] = [];
    const spies = ['log', 'warn', 'error', 'debug', 'verbose'] as const;
    const loggerSpies = spies.map((method) =>
      jest.spyOn(Logger.prototype, method).mockImplementation((...args: unknown[]) => {
        logChunks.push(args.map(String).join(' '));
      }),
    );
    const consoleSpies = (['log', 'info', 'warn', 'error'] as const).map((method) =>
      jest.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        logChunks.push(args.map(String).join(' '));
      }),
    );

    const created = await admin.post('/api/users').send({ email, name: 'People Probe', jobTitle: 'Ops' }).expect(201);
    createdIds.push(created.body.id);
    const temp = created.body.temporaryPassword as string;
    expect(temp.length).toBeGreaterThanOrEqual(12);
    expect(created.body.mustChangePassword).toBeUndefined();
    expect(created.body.passwordHash).toBeUndefined();
    expect(logChunks.join('\n')).not.toContain(temp);
    loggerSpies.forEach((spy) => spy.mockRestore());
    consoleSpies.forEach((spy) => spy.mockRestore());

    await admin.post('/api/users').send({ email: email.toUpperCase(), name: 'Dup' }).expect(409);

    const newbie = request.agent(app.getHttpServer());
    const login = await newbie.post('/api/auth/login').send({ email, password: temp }).expect(201);
    expect(login.body.user.mustChangePassword).toBe(true);
    const setCookie = login.headers['set-cookie'];
    const cookieHeader = Array.isArray(setCookie) ? setCookie.join(';') : String(setCookie ?? '');
    expect(cookieHeader).toContain(AUTH_COOKIE_NAME);

    const blocked = await newbie.get('/api/tasks').expect(403);
    expect(blocked.body.code).toBe('MUST_CHANGE_PASSWORD');
    await newbie.get('/api/auth/me').expect(200);
    await newbie.get('/api/me').expect(200);

    await newbie
      .post('/api/me/password')
      .send({ currentPassword: temp, newPassword: 'people-pass-1' })
      .expect(201);
    const me = await newbie.get('/api/auth/me').expect(200);
    expect(me.body.mustChangePassword).toBe(false);
    await newbie.get('/api/tasks').expect(200);

    await admin.patch(`/api/users/${created.body.id}`).send({ isActive: false }).expect(200);
    const denied = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'people-pass-1' })
      .expect(401);
    expect(denied.body.message).toBe('Неверный email или пароль');

    const listed = await admin.get('/api/users').expect(200);
    expect((listed.body as Array<{ id: string }>).some((row) => row.id === created.body.id)).toBe(false);
    const withInactive = await admin.get('/api/users?includeInactive=true').expect(200);
    expect((withInactive.body as Array<{ id: string }>).some((row) => row.id === created.body.id)).toBe(true);

    await newbie.get('/api/me').expect(401);
  });

  it('reset password forces change and admin cannot deactivate self', async () => {
    const stamp = Date.now();
    const email = `reset.${stamp}@almea.ru`;
    const created = await admin.post('/api/users').send({ email, name: 'Reset Probe' }).expect(201);
    createdIds.push(created.body.id);
    const firstTemp = created.body.temporaryPassword as string;
    const user = request.agent(app.getHttpServer());
    await user.post('/api/auth/login').send({ email, password: firstTemp }).expect(201);
    await user.post('/api/me/password').send({ currentPassword: firstTemp, newPassword: 'reset-pass-1' }).expect(201);
    await new Promise((resolve) => setTimeout(resolve, 1100));

    const reset = await admin.post(`/api/users/${created.body.id}/reset-password`).expect(201);
    const nextTemp = reset.body.temporaryPassword as string;
    expect(nextTemp).not.toBe(firstTemp);
    await user.get('/api/tasks').expect(401);

    const afterReset = request.agent(app.getHttpServer());
    await afterReset.post('/api/auth/login').send({ email, password: nextTemp }).expect(201);
    await afterReset.get('/api/tasks').expect(403);

    const me = await admin.get('/api/auth/me').expect(200);
    await admin.patch(`/api/users/${me.body.id}`).send({ isActive: false }).expect(400);
  });
});
