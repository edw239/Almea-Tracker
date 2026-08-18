import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AUTH_COOKIE_NAME } from '../src/identity/auth/auth.constants';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const password = process.env.SEED_ADMIN_PASSWORD ?? '';
const canSmoke =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  password.length >= 8;

(canSmoke ? describe : describe.skip)('Smoke flow (e2e)', () => {
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;
  let listId = '';
  let taskId = '';

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
    await app.close();
  });

  it('login → list → create → move → inbox → template', async () => {
    const login = await agent.post('/api/auth/login').send({ email, password }).expect(201);
    expect(login.body.user?.email).toBe(email.toLowerCase());
    expect(login.headers['set-cookie']?.join(';') ?? '').toContain(AUTH_COOKIE_NAME);

    const me = await agent.get('/api/auth/me').expect(200);
    expect(me.body.id).toBeTruthy();

    const spaces = await agent.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ systemKey?: string | null; lists?: Array<{ id: string; systemKey?: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const strategy = ops?.lists?.find((list) => list.systemKey === 'strategy');
    expect(strategy?.id).toBeTruthy();
    listId = strategy!.id;

    const created = await agent
      .post(`/api/task-lists/${listId}/tasks`)
      .send({ title: `Smoke ${Date.now()}` })
      .expect(201);
    taskId = created.body.id;
    expect(taskId).toBeTruthy();

    await agent
      .patch(`/api/tasks/${taskId}/move`)
      .send({ afterTaskId: null })
      .expect(200);

    const views = await agent.get(`/api/task-lists/${listId}/views`).expect(200);
    expect(Array.isArray(views.body)).toBe(true);

    const saved = await agent
      .post('/api/task-views')
      .send({
        listId,
        name: `Smoke view ${Date.now()}`,
        viewType: 'LIST',
        groupBy: 'STATUS',
        isShared: false,
        filters: { op: 'AND', children: [{ field: 'priority', operator: 'is', value: 'HIGH' }] },
      })
      .expect(201);
    expect(saved.body.id).toBeTruthy();

    const templates = await agent.get(`/api/task-lists/${listId}/templates`).expect(200);
    expect(Array.isArray(templates.body)).toBe(true);
    if (templates.body.length > 0) {
      const expanded = await agent
        .post(`/api/task-lists/${listId}/tasks/from-template/${templates.body[0].id}`)
        .expect(201);
      expect(Array.isArray(expanded.body)).toBe(true);
      expect(expanded.body.length).toBeGreaterThan(0);
    }

    const inbox = await agent.get('/api/notifications').expect(200);
    expect(Array.isArray(inbox.body)).toBe(true);
    await agent.get('/api/notifications/unread-count').expect(200);

    await agent.delete(`/api/task-views/${saved.body.id}`).expect(200);
  });
});
