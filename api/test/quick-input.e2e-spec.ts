import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorCode } from '../src/common/errors';
import { SYSTEM_LIST_PERSONAL_INBOX } from '../src/common/constants';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  adminPassword.length >= 8;

(canRun ? describe : describe.skip)('Quick input / delegation (e2e)', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  let inboxId: string;
  let otherUserId: string;

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

    const spaces = await admin.get('/api/task-spaces').expect(200);
    const personal = (
      spaces.body as Array<{
        systemKey: string | null;
        lists?: Array<{ id: string; systemKey: string | null }>;
      }>
    ).find((row) => row.systemKey === 'personal');
    const inbox = personal?.lists?.find((row) => row.systemKey === SYSTEM_LIST_PERSONAL_INBOX);
    expect(inbox?.id).toBeTruthy();
    inboxId = inbox!.id;

    const stamp = Date.now();
    const created = await admin
      .post('/api/users')
      .send({ email: `input.${stamp}@almea.ru`, name: 'Input Peer' })
      .expect(201);
    otherUserId = created.body.id;
    await admin.patch(`/api/users/${otherUserId}`).send({ isActive: true }).expect(200);
  });

  afterAll(async () => {
    if (otherUserId) {
      await admin.patch(`/api/users/${otherUserId}`).send({ isActive: false });
    }
    await app.close();
  });

  it('delegation without due → 400 with code; personal without due → 201', async () => {
    const denied = await admin
      .post(`/api/task-lists/${inboxId}/tasks`)
      .send({ title: 'Delegate no due', assigneeIds: [otherUserId] })
      .expect(400);
    expect(denied.body.code).toBe(ErrorCode.TASK_DELEGATION_REQUIRES_DUE_DATE);

    const personal = await admin
      .post(`/api/task-lists/${inboxId}/tasks`)
      .send({ title: `Idea ${Date.now()}`, assigneeIds: [] })
      .expect(201);
    expect(personal.body.dueDate).toBeNull();
    expect(personal.body.assignees).toEqual([]);
  });
  it('one-shot create with title+assignee+due+brand and untriaged scope', async () => {
    const brand = await admin
      .post('/api/host-entities')
      .send({ entityType: 'brand', name: `Input Brand ${Date.now()}` })
      .expect(201);

    const created = await admin
      .post(`/api/task-lists/${inboxId}/tasks`)
      .send({
        title: `Full row ${Date.now()}`,
        assigneeIds: [otherUserId],
        dueDate: '2030-01-15',
        hostEntityId: brand.body.id,
      })
      .expect(201);
    expect(created.body.hostEntityId).toBe(brand.body.id);

    const idea = await admin
      .post(`/api/task-lists/${inboxId}/tasks`)
      .send({ title: `Untriaged ${Date.now()}`, assigneeIds: [] })
      .expect(201);

    const untriaged = await admin.get('/api/tasks?scope=untriaged').expect(200);
    expect((untriaged.body as Array<{ id: string }>).some((row) => row.id === idea.body.id)).toBe(
      true,
    );
    expect((untriaged.body as Array<{ id: string }>).some((row) => row.id === created.body.id)).toBe(
      false,
    );

    const summary = await admin.get('/api/me/summary').expect(200);
    expect(typeof summary.body.untriaged).toBe('number');
    expect(summary.body.untriaged).toBeGreaterThanOrEqual(1);

    await admin.patch(`/api/host-entities/${brand.body.id}`).send({ isArchived: true });
  });
});
