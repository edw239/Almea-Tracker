process.env.SCHEDULER_ENABLED = 'false';

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { TaskNotificationsService } from '../src/work-management/services/task-notifications.service';
import { TaskSchedulesService } from '../src/work-management/services/task-schedules.service';

const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  adminPassword.length >= 8;

(canRun ? describe : describe.skip)('Task schedules / rhythm (e2e)', () => {
  jest.setTimeout(60_000);

  let app: INestApplication;
  let admin: ReturnType<typeof request.agent>;
  let prisma: PrismaService;
  let schedules: TaskSchedulesService;
  let notifications: TaskNotificationsService;

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
    prisma = app.get(PrismaService);
    schedules = app.get(TaskSchedulesService);
    notifications = app.get(TaskNotificationsService);
    admin = request.agent(app.getHttpServer());
    await admin.post('/api/auth/login').send({ email: adminEmail, password: adminPassword }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates schedule and does not duplicate tasks on repeated period run', async () => {
    const spaces = await admin.get('/api/task-spaces').expect(200);
    const ops = (
      spaces.body as Array<{
        systemKey?: string | null;
        lists?: Array<{ id: string; systemKey?: string }>;
      }>
    ).find((s) => s.systemKey === 'ops');
    const listId = ops?.lists?.find((list) => list.systemKey === 'strategy')?.id ?? ops?.lists?.[0]?.id;
    expect(listId).toBeTruthy();
    const stamp = Date.now();
    const title = `Rhythm idempotent ${stamp}`;

    const created = await admin
      .post(`/api/task-lists/${listId}/schedules`)
      .send({
        title,
        frequency: 'DAILY',
        atMinute: 8 * 60,
        timezone: 'Asia/Dubai',
        dueInDays: 1,
      })
      .expect(201);

    await prisma.taskSchedule.update({
      where: { id: created.body.id },
      data: { nextRunAt: new Date(Date.now() - 60_000) },
    });

    const first = await schedules.runDueSchedules(new Date());
    expect(first.claimed).toBeGreaterThanOrEqual(1);

    const tasksAfterFirst = await prisma.task.count({
      where: { listId: listId!, title, deletedAt: null },
    });
    expect(tasksAfterFirst).toBe(1);

    await prisma.taskSchedule.update({
      where: { id: created.body.id },
      data: { nextRunAt: new Date(Date.now() - 60_000) },
    });
    const second = await schedules.runDueSchedules(new Date());
    expect(second.createdTasks).toBe(0);

    const tasksAfterSecond = await prisma.task.count({
      where: { listId: listId!, title, deletedAt: null },
    });
    expect(tasksAfterSecond).toBe(1);

    await admin.patch(`/api/task-schedules/${created.body.id}`).send({ isActive: false }).expect(200);
  });

  it('overdue reaches a user who never opened inbox', async () => {
    const stamp = Date.now();
    const peer = await admin
      .post('/api/users')
      .send({ email: `rhythm.${stamp}@almea.ru`, name: 'Rhythm Peer' })
      .expect(201);

    const spaces = await admin.get('/api/task-spaces').expect(200);
    const ops = (
      spaces.body as Array<{
        systemKey?: string | null;
        lists?: Array<{ id: string; systemKey?: string }>;
      }>
    ).find((s) => s.systemKey === 'ops');
    const listId = ops?.lists?.find((list) => list.systemKey === 'strategy')?.id ?? ops?.lists?.[0]?.id;
    expect(listId).toBeTruthy();

    const yesterday = new Date(Date.now() - 36 * 3600_000).toISOString();
    const task = await admin
      .post(`/api/task-lists/${listId}/tasks`)
      .send({
        title: `Overdue silent ${stamp}`,
        assigneeIds: [peer.body.id],
        dueDate: yesterday,
      })
      .expect(201);

    await notifications.scanDueBucketsAllUsers();

    const rows = await prisma.taskNotification.findMany({
      where: {
        userId: peer.body.id,
        taskId: task.body.id,
        code: 'TASK_OVERDUE',
      },
    });
    expect(rows.length).toBeGreaterThanOrEqual(1);

    await admin.patch(`/api/users/${peer.body.id}`).send({ isActive: false });
  });
});
