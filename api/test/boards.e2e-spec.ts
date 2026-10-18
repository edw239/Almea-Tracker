import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@almea.ru';
const password = process.env.SEED_ADMIN_PASSWORD ?? '';
const canRun =
  Boolean(process.env.DATABASE_URL) &&
  Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) &&
  password.length >= 8;

(canRun ? describe : describe.skip)('Jira boards (e2e)', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let agent: ReturnType<typeof request.agent>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send({ email, password }).expect(201);
  });

  afterAll(async () => {
    await app.close();
  });

  it('creates a board, ranks a card, and opens a task by key', async () => {
    const spaces = await agent.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ id: string; systemKey?: string; lists?: Array<{ id: string; systemKey?: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const listId = ops?.lists?.[0]?.id;
    expect(listId).toBeTruthy();

    const board = await agent
      .post('/api/boards')
      .send({ name: `Доска ${Date.now()}`, type: 'KANBAN', sources: [{ listId }], defaultListId: listId })
      .expect(201);
    const boardId = board.body.id as string;

    const created = await agent.post(`/api/boards/${boardId}/cards`).send({ title: 'Карточка' }).expect(201);
    expect(created.body.key).toMatch(/^[A-Z][A-Z0-9]+-\d+$/);
    const byKey = await agent.get(`/api/tasks/by-key/${created.body.key}`).expect(200);
    expect(byKey.body.id).toBe(created.body.id);

    const view = await agent.get(`/api/boards/${boardId}/view`).expect(200);
    const columnId = view.body.columns[1]?.id ?? view.body.columns[0]?.id;
    expect(columnId).toBeTruthy();
    await agent
      .post(`/api/boards/${boardId}/cards/${created.body.id}/move`)
      .send({ columnId, beforeId: null, afterId: null })
      .expect(201);
    const again = await agent.get(`/api/boards/${boardId}/view`).expect(200);
    const card = (again.body.cards as Array<{ id: string; rank: string }>).find((item) => item.id === created.body.id);
    expect(card?.rank).toBeTruthy();
    await agent.delete(`/api/boards/${boardId}`).expect(200);
  });

  it('allows a backlog task without a due date and rejects leaving without one', async () => {
    const spaces = await agent.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ systemKey?: string; lists?: Array<{ id: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const listId = ops?.lists?.[0]?.id as string;
    const board = await agent
      .post('/api/boards')
      .send({ name: `Бэклог ${Date.now()}`, type: 'KANBAN', sources: [{ listId }], defaultListId: listId })
      .expect(201);
    await agent.patch(`/api/boards/${board.body.id}`).send({ backlogEnabled: true }).expect(200);
    const stamp = Date.now();
    const createdUser = await agent
      .post('/api/users')
      .send({ email: `board.${stamp}@almea.ru`, name: 'Исполнитель доски' })
      .expect(201);
    const other = { id: createdUser.body.id as string };
    const task = await agent
      .post(`/api/boards/${board.body.id}/backlog/tasks`)
      .send({ title: 'В подготовке', listId })
      .expect(201);
    if (other) {
      await agent.patch(`/api/tasks/${task.body.id}`).send({ assigneeIds: [other.id], dueDate: null }).expect(200);
      const view = await agent.get(`/api/boards/${board.body.id}/view`).expect(200);
      const columnId = view.body.columns[0]?.id as string;
      const moved = await agent
        .post(`/api/boards/${board.body.id}/cards/${task.body.id}/move`)
        .send({ columnId });
      expect(moved.status).toBe(400);
      expect(moved.body.code).toBe('TASK_DELEGATION_REQUIRES_DUE_DATE');
    }
    await agent.delete(`/api/boards/${board.body.id}`).expect(200);
  });

  it('starts and completes a sprint and reports velocity', async () => {
    const spaces = await agent.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ systemKey?: string; lists?: Array<{ id: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const listId = ops?.lists?.[0]?.id as string;
    const board = await agent
      .post('/api/boards')
      .send({ name: `Скрам ${Date.now()}`, type: 'SCRUM', sources: [{ listId }], defaultListId: listId })
      .expect(201);
    const sprint = await agent
      .post(`/api/boards/${board.body.id}/sprints`)
      .send({ name: 'Спринт e2e', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 14 * 86400000).toISOString() })
      .expect(201);
    const task = await agent.post(`/api/boards/${board.body.id}/backlog/tasks`).send({ title: 'В спринте', listId }).expect(201);
    await agent.patch(`/api/tasks/${task.body.id}`).send({ sprintId: sprint.body.id, storyPoints: 3 }).expect(200);
    const started = await agent.post(`/api/sprints/${sprint.body.id}/start`).send({ confirmMissingDue: true }).expect(201);
    expect(started.body.state).toBe('ACTIVE');
    await agent.post(`/api/sprints/${sprint.body.id}/complete`).send({ unfinishedTo: 'backlog' }).expect(201);
    const velocity = await agent.get(`/api/boards/${board.body.id}/reports/velocity`).expect(200);
    expect(Array.isArray(velocity.body.sprints)).toBe(true);
    expect(velocity.body.sprints.length).toBeGreaterThan(0);
    await agent.delete(`/api/boards/${board.body.id}`).expect(200);
  });

  it('hides a board from an outsider, blocks a viewer, and lets an assignee move a card', async () => {
    const spaces = await agent.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ id: string; systemKey?: string; lists?: Array<{ id: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const listId = ops?.lists?.[0]?.id as string;
    const board = await agent
      .post('/api/boards')
      .send({ name: `Права ${Date.now()}`, type: 'KANBAN', sources: [{ spaceId: ops!.id }], defaultListId: listId })
      .expect(201);
    const card = await agent.post(`/api/boards/${board.body.id}/cards`).send({ title: 'Чужая карточка' }).expect(201);

    const stamp = Date.now();
    const outsider = await provision(app, agent, `outsider.${stamp}@almea.ru`, 'MEMBER');
    await outsider.get(`/api/boards/${board.body.id}/view`).expect(404);

    const viewer = await provision(app, agent, `viewer.${stamp}@almea.ru`, 'MEMBER');
    const viewerId = (await viewer.get('/api/auth/me')).body.id as string;
    const prisma = app.get(PrismaService);
    await prisma.taskSpaceMember.create({
      data: { spaceId: ops!.id, userId: viewerId, role: 'VIEWER' },
    });
    await viewer.get(`/api/boards/${board.body.id}/view`).expect(200);
    const view = await agent.get(`/api/boards/${board.body.id}/view`).expect(200);
    const columnId = (view.body.columns as Array<{ id: string }>)[0]?.id;
    await viewer
      .post(`/api/boards/${board.body.id}/cards/${card.body.id}/move`)
      .send({ columnId })
      .expect(403);

    const adminMe = await agent.get('/api/auth/me').expect(200);
    await agent.patch(`/api/boards/${board.body.id}`).send({ swimlaneBy: 'ASSIGNEE' }).expect(200);
    await agent.patch(`/api/tasks/${card.body.id}`).send({ assigneeIds: [viewerId], dueDate: '2026-10-30' }).expect(200);
    await viewer
      .post(`/api/boards/${board.body.id}/cards/${card.body.id}/move`)
      .send({ columnId, laneKey: adminMe.body.id })
      .expect(403);
    const second = (view.body.columns as Array<{ id: string }>)[1]?.id ?? columnId;
    await viewer
      .post(`/api/boards/${board.body.id}/cards/${card.body.id}/move`)
      .send({ columnId: second })
      .expect(201);
    await agent.delete(`/api/boards/${board.body.id}`).expect(200);
  });

  it('keeps the old key after the space key changes', async () => {
    const space = await agent
      .post('/api/task-spaces')
      .send({ name: `Ключи ${Date.now()}`, key: `K${Date.now().toString().slice(-6)}` })
      .expect(201);
    const list = await agent
      .post(`/api/task-spaces/${space.body.id}/lists`)
      .send({ name: 'Список' })
      .expect(201);
    const task = await agent.post(`/api/task-lists/${list.body.id}/tasks`).send({ title: 'С ключом' }).expect(201);
    const oldKey = task.body.key as string;
    const nextKey = `Z${Date.now().toString().slice(-6)}`;
    await agent.patch(`/api/task-spaces/${space.body.id}/key`).send({ key: nextKey }).expect(200);
    const viaAlias = await agent.get(`/api/tasks/by-key/${oldKey}`).expect(200);
    expect(viaAlias.body.id).toBe(task.body.id);
    expect(viaAlias.body.key).toMatch(new RegExp(`^${nextKey}-`));
  });

  it('runs the project-manager path: two boards, epic, sprint, reports, and a key', async () => {
    const stamp = Date.now();
    const pm = await provision(app, agent, `pm.${stamp}@almea.ru`, 'PROJECT_MANAGER');
    const spaces = await pm.get('/api/task-spaces').expect(200);
    const ops = (spaces.body as Array<{ id: string; systemKey?: string; lists?: Array<{ id: string }> }>).find(
      (space) => space.systemKey === 'ops',
    );
    const listId = ops!.lists![0]!.id;

    const brand = await pm
      .post('/api/host-entities')
      .send({ entityType: 'brand', name: `Бренд ${stamp}` })
      .expect(201);
    const kanban = await pm
      .post('/api/boards')
      .send({
        name: `Канбан ${stamp}`,
        type: 'KANBAN',
        sources: [{ spaceId: ops!.id }],
        defaultListId: listId,
        filter: { op: 'AND', children: [{ field: 'host_entity_id', operator: 'is', value: brand.body.id }] },
      })
      .expect(201);

    const scrum = await pm
      .post('/api/boards')
      .send({ name: `Скрам ${stamp}`, type: 'SCRUM', sources: [{ spaceId: ops!.id }], defaultListId: listId })
      .expect(201);
    const types = await pm.get(`/api/task-spaces/${ops!.id}/task-types`).expect(200);
    const epicType = (types.body as Array<{ id: string; key: string }>).find((item) => item.key === 'epic');
    expect(epicType).toBeTruthy();
    const epic = await pm
      .post(`/api/task-lists/${listId}/tasks`)
      .send({ title: `Эпик ${stamp}`, taskTypeId: epicType!.id })
      .expect(201);

    const end = new Date(Date.now() + 14 * 86_400_000);
    const sprint = await pm
      .post(`/api/boards/${scrum.body.id}/sprints`)
      .send({ name: `Спринт ${stamp}`, endDate: end.toISOString() })
      .expect(201);
    const backlogTask = await pm
      .post(`/api/boards/${scrum.body.id}/backlog/tasks`)
      .send({ title: `Поручение ${stamp}`, listId })
      .expect(201);
    const me = await pm.get('/api/auth/me').expect(200);
    const adminMe = await agent.get('/api/auth/me').expect(200);
    await pm
      .patch(`/api/tasks/${backlogTask.body.id}`)
      .send({
        assigneeIds: [me.body.id, adminMe.body.id],
        epicId: epic.body.id,
        storyPoints: 5,
        sprintId: sprint.body.id,
        hostEntityId: brand.body.id,
      })
      .expect(200);

    const blocked = await pm.post(`/api/sprints/${sprint.body.id}/start`).send({}).expect(400);
    expect(blocked.body.code).toBe('SPRINT_START_NEEDS_DUE');
    expect(blocked.body.tasks[0].key).toBe(backlogTask.body.key);

    const started = await pm.post(`/api/sprints/${sprint.body.id}/start`).send({ confirmMissingDue: true }).expect(201);
    expect(started.body.state).toBe('ACTIVE');
    const afterStart = await pm.get(`/api/tasks/${backlogTask.body.id}`).expect(200);
    expect(afterStart.body.listStatusId).not.toBe(backlogTask.body.listStatusId);
    expect(afterStart.body.dueDate).toBeTruthy();

    await pm
      .post(`/api/boards/${scrum.body.id}/quick-filters`)
      .send({
        name: 'Эпик',
        filter: { op: 'AND', children: [{ field: 'epic_id', operator: 'is', value: epic.body.id }] },
      })
      .expect(201);
    const standup = await pm.get(`/api/boards/${scrum.body.id}/view?mine=1`).expect(200);
    expect((standup.body.cards as Array<{ id: string }>).some((card) => card.id === backlogTask.body.id)).toBe(true);

    const second = await pm
      .post(`/api/boards/${scrum.body.id}/cards`)
      .send({ title: `Вторая ${stamp}` })
      .expect(201);
    const view = await pm.get(`/api/boards/${scrum.body.id}/view`).expect(200);
    const firstCard = (view.body.cards as Array<{ id: string; rank: string }>).find((card) => card.id === backlogTask.body.id);
    await pm
      .post(`/api/boards/${scrum.body.id}/cards/${second.body.id}/move`)
      .send({ columnId: view.body.columns[0].id, beforeId: null, afterId: firstCard?.id ?? null })
      .expect(201);

    await pm
      .post(`/api/sprints/${sprint.body.id}/complete`)
      .send({ unfinishedTo: 'sprint', createSprint: { name: `Следующий ${stamp}` } })
      .expect(201);
    const carried = await pm.get(`/api/tasks/${backlogTask.body.id}`).expect(200);
    expect(carried.body.sprintId).not.toBe(sprint.body.id);

    const burndown = await pm
      .get(`/api/boards/${scrum.body.id}/reports/burndown?metric=points&sprintId=${sprint.body.id}`)
      .expect(200);
    expect(burndown.body.points.length).toBeGreaterThan(0);
    const report = await pm.get(`/api/boards/${scrum.body.id}/reports/sprint?sprintId=${sprint.body.id}`).expect(200);
    expect(report.body.commitment).toBeGreaterThan(0);
    const velocity = await pm.get(`/api/boards/${scrum.body.id}/reports/velocity`).expect(200);
    expect(velocity.body.sprints.some((row: { name: string }) => row.name === sprint.body.name)).toBe(true);

    const byKey = await pm.get(`/api/tasks/by-key/${backlogTask.body.key}`).expect(200);
    expect(byKey.body.id).toBe(backlogTask.body.id);
    const onBrand = await pm.get(`/api/boards/${kanban.body.id}/view`).expect(200);
    expect((onBrand.body.cards as Array<{ id: string }>).some((card) => card.id === backlogTask.body.id)).toBe(true);

    await pm.delete(`/api/boards/${scrum.body.id}`).expect(200);
    await pm.delete(`/api/boards/${kanban.body.id}`).expect(200);
  });
});

async function provision(
  app: INestApplication,
  admin: ReturnType<typeof request.agent>,
  email: string,
  role: 'MEMBER' | 'PROJECT_MANAGER',
) {
  const created = await admin.post('/api/users').send({ email, name: email.split('@')[0], role }).expect(201);
  const client = request.agent(app.getHttpServer());
  await client.post('/api/auth/login').send({ email: created.body.email, password: created.body.temporaryPassword }).expect(201);
  await client
    .post('/api/me/password')
    .send({ currentPassword: created.body.temporaryPassword, newPassword: 'board-pass-1' })
    .expect(201);
  return client;
}
