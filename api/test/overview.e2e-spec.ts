import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  adminPassword.length >= 8;

(canRun ? describe : describe.skip)('Owner overview (e2e)', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;

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
    await app.close();
  });

  it('returns five blocks and company scope for admin', async () => {
    const res = await admin.get('/api/overview').expect(200);
    expect(res.body.timezone).toBeTruthy();
    expect(res.body.scope).toBe('company');
    expect(Array.isArray(res.body.unassigned)).toBe(true);
    expect(Array.isArray(res.body.stale)).toBe(true);
    expect(Array.isArray(res.body.blocked)).toBe(true);
    expect(Array.isArray(res.body.awaitingReview)).toBe(true);
    expect(Array.isArray(res.body.overdueByUser)).toBe(true);
  });

  it('member without owned spaces sees only visible scope', async () => {
    const stamp = Date.now();
    const created = await admin
      .post('/api/users')
      .send({ email: `ov.${stamp}@almea.ru`, name: 'Overview Peer' })
      .expect(201);
    const temp = created.body.temporaryPassword as string;
    const member = request.agent(app.getHttpServer());
    await member.post('/api/auth/login').send({ email: created.body.email, password: temp }).expect(201);
    await member
      .post('/api/me/password')
      .send({ currentPassword: temp, newPassword: 'overview-pass-1' })
      .expect(201);

    const res = await member.get('/api/overview').expect(200);
    expect(res.body.scope).toBe('visible');
    expect(Array.isArray(res.body.unassigned)).toBe(true);

    await admin.patch(`/api/users/${created.body.id}`).send({ isActive: false });
  });
});
