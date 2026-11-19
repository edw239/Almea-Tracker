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

(canRun ? describe : describe.skip)('Projects (e2e)', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  const projectIds: string[] = [];
  const userIds: string[] = [];

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
    for (const id of projectIds) {
      await admin.post(`/api/projects/${id}/close`).send({ closeNote: 'e2e' });
    }
    for (const id of userIds) {
      await admin.patch(`/api/users/${id}`).send({ isActive: false });
    }
    await app.close();
  });

  it('draft → not ready → active → link → close freezes the link → reopen', async () => {
    const stamp = Date.now();
    const me = await admin.get('/api/me').expect(200);
    const created = await admin.post('/api/projects').send({ name: `Запуск ${stamp}` }).expect(201);
    projectIds.push(created.body.id);
    expect(created.body.status).toBe('DRAFT');
    expect(created.body.listId).toEqual(expect.any(String));
    expect(created.body.signal).toBe('green');

    await admin
      .post('/api/projects')
      .send({ name: `  запуск   ${stamp} ` })
      .expect(409);

    const blocked = await admin
      .patch(`/api/projects/${created.body.id}`)
      .send({ status: 'ACTIVE' })
      .expect(400);
    expect(blocked.body.code).toBe('PROJECT_NOT_READY');

    const active = await admin
      .patch(`/api/projects/${created.body.id}`)
      .send({
        outcome: 'SKU на складе',
        targetEndDate: '2027-06-01',
        leadUserId: me.body.id,
        status: 'ACTIVE',
      })
      .expect(200);
    expect(active.body.status).toBe('ACTIVE');
    expect(active.body.lead.id).toBe(me.body.id);

    const spaces = await admin.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ systemKey: string | null; lists: Array<{ id: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    expect(ops?.lists.length).toBeGreaterThan(0);
    const task = await admin
      .post(`/api/task-lists/${ops!.lists[0].id}/tasks`)
      .send({ title: `Партия ${stamp}`, projectId: created.body.id })
      .expect(201);
    expect(task.body.projectId).toBe(created.body.id);

    const coordination = await admin
      .post(`/api/task-lists/${created.body.listId}/tasks`)
      .send({ title: `Решение ${stamp}` })
      .expect(201);
    expect(coordination.body.projectId).toBe(created.body.id);

    const card = await admin.get(`/api/projects/${created.body.id}`).expect(200);
    expect(card.body.openTaskCount).toBeGreaterThanOrEqual(2);
    expect(card.body.tasks.some((row: { id: string }) => row.id === task.body.id)).toBe(true);

    await admin.post(`/api/projects/${created.body.id}/close`).send({ closeNote: 'Сдано' }).expect(201);
    const frozen = await admin
      .patch(`/api/tasks/${task.body.id}`)
      .send({ projectId: null })
      .expect(409);
    expect(frozen.body.code).toBe('PROJECT_CLOSED');

    const reopened = await admin.post(`/api/projects/${created.body.id}/reopen`).expect(201);
    expect(reopened.body.status).toBe('ACTIVE');
    expect(reopened.body.closeNote).toBeNull();

    await admin.patch(`/api/tasks/${task.body.id}`).send({ projectId: null }).expect(200);
  });

  it('a member cannot create a project and cannot see a draft they are not in', async () => {
    const stamp = Date.now();
    const hidden = await admin.post('/api/projects').send({ name: `Скрытый ${stamp}` }).expect(201);
    projectIds.push(hidden.body.id);

    const created = await admin
      .post('/api/users')
      .send({ email: `project.member.${stamp}@almea.ru`, name: 'Project Member' })
      .expect(201);
    userIds.push(created.body.id);
    const temp = created.body.temporaryPassword as string;
    const member = request.agent(app.getHttpServer());
    await member.post('/api/auth/login').send({ email: created.body.email, password: temp }).expect(201);
    await member
      .post('/api/me/password')
      .send({ currentPassword: temp, newPassword: 'member-pass-1' })
      .expect(201);

    await member.post('/api/projects').send({ name: `Чужой ${stamp}` }).expect(403);
    await member.get(`/api/projects/${hidden.body.id}`).expect(404);
  });
});
