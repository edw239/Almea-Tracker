import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { ErrorCode } from '../src/common/errors';
import { LIST_STATUS_NAME_IN_REVIEW, SYSTEM_LIST_PERSONAL_INBOX } from '../src/common/constants';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  adminPassword.length >= 8;

(canRun ? describe : describe.skip)('Review loop (e2e)', () => {
  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  let member: ReturnType<typeof request.agent>;
  let listId: string;
  let otherUserId: string;
  let otherEmail: string;
  let otherPass: string;

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

    const stamp = Date.now();
    otherEmail = `review.${stamp}@almea.ru`;
    otherPass = 'review-pass-1';
    const created = await admin
      .post('/api/users')
      .send({ email: otherEmail, name: 'Review Peer' })
      .expect(201);
    otherUserId = created.body.id;
    const temp = created.body.temporaryPassword as string;
    member = request.agent(app.getHttpServer());
    await member.post('/api/auth/login').send({ email: otherEmail, password: temp }).expect(201);
    await member.post('/api/me/password').send({ currentPassword: temp, newPassword: otherPass }).expect(201);

    // System personal space is visible to all; assignee gets assignee-level access.
    const spaces = await admin.get('/api/task-spaces').expect(200);
    const personal = (
      spaces.body as Array<{ systemKey?: string | null; lists?: Array<{ id: string; systemKey?: string }> }>
    ).find((space) => space.systemKey === 'personal');
    const inbox = personal?.lists?.find((list) => list.systemKey === SYSTEM_LIST_PERSONAL_INBOX);
    expect(inbox?.id).toBeTruthy();
    listId = inbox!.id;
  });

  afterAll(async () => {
    if (otherUserId) {
      await admin.patch(`/api/users/${otherUserId}`).send({ isActive: false });
    }
    await app.close();
  });

  it('assignee cannot DONE when review required; submit notifies once; reject keeps due', async () => {
    const created = await admin
      .post(`/api/task-lists/${listId}/tasks`)
      .send({
        title: `Review ${Date.now()}`,
        assigneeIds: [otherUserId],
        dueDate: '2030-02-01',
      })
      .expect(201);
    expect(created.body.reviewRequired).toBe(true);
    const taskId = created.body.id as string;
    const dueDate = created.body.dueDate;

    const statuses = await admin.get(`/api/task-lists/${listId}/statuses`).expect(200);
    const review = (statuses.body as Array<{ id: string; name: string; category: string }>).find(
      (row) => row.name === LIST_STATUS_NAME_IN_REVIEW,
    );
    const done = (statuses.body as Array<{ id: string; name: string; category: string }>).find(
      (row) => row.category === 'DONE',
    );
    const running = (statuses.body as Array<{ id: string; name: string }>).find(
      (row) => row.name === 'В работе',
    );
    expect(review?.id).toBeTruthy();
    expect(done?.id).toBeTruthy();
    expect(running?.id).toBeTruthy();

    const denied = await member.patch(`/api/tasks/${taskId}/move`).send({ listStatusId: done!.id }).expect(403);
    expect(denied.body.code).toBe(ErrorCode.TASK_REVIEW_BLOCKS_DONE);

    const submitted = await member
      .patch(`/api/tasks/${taskId}/move`)
      .send({ listStatusId: review!.id })
      .expect(200);
    expect(submitted.body.status).toBe('IN_PROGRESS');
    expect(submitted.body.completedAt).toBeNull();
    expect(submitted.body.submittedAt).toBeTruthy();

    const inbox = await admin.get('/api/notifications').expect(200);
    const reviewNotes = (inbox.body as Array<{ code: string; taskId: string; dedupKey?: string }>).filter(
      (row) => row.code === 'TASK_REVIEW_REQUESTED' && row.taskId === taskId,
    );
    expect(reviewNotes.length).toBe(1);

    await member.patch(`/api/tasks/${taskId}/move`).send({ listStatusId: review!.id }).expect(200);
    const inbox2 = await admin.get('/api/notifications').expect(200);
    const again = (inbox2.body as Array<{ code: string; taskId: string }>).filter(
      (row) => row.code === 'TASK_REVIEW_REQUESTED' && row.taskId === taskId,
    );
    expect(again.length).toBe(1);

    const rejected = await admin
      .patch(`/api/tasks/${taskId}/move`)
      .send({ listStatusId: running!.id, reviewRejectReason: 'Нужны цифры' })
      .expect(200);
    expect(rejected.body.submittedAt).toBeNull();
    expect(rejected.body.dueDate).toBe(dueDate);

    const detail = await admin.get(`/api/tasks/${taskId}`).expect(200);
    const activities = detail.body.activities as Array<{ action: string; details?: { reason?: string } }>;
    expect(activities.some((row) => row.action === 'REVIEW_REJECTED')).toBe(true);

    const reviewScope = await admin.get('/api/tasks?scope=review').expect(200);
    expect(Array.isArray(reviewScope.body)).toBe(true);
  });
});
