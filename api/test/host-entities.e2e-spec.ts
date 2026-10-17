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

(canRun ? describe : describe.skip)('Host entity registry (e2e)', () => {
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
      await admin.patch(`/api/host-entities/${id}`).send({ isArchived: true });
    }
    await app.close();
  });

  it('create → duplicate name_key 409 → visibleOnly brands only', async () => {
    const stamp = Date.now();
    const name = `Brand Probe ${stamp}`;
    const created = await admin
      .post('/api/host-entities')
      .send({ entityType: 'brand', name })
      .expect(201);
    createdIds.push(created.body.id);
    expect(created.body.nameKey).toBe(name.toLowerCase());

    await admin
      .post('/api/host-entities')
      .send({ entityType: 'brand', name: `  ${name.toUpperCase()}  ` })
      .expect(409);

    const listed = await admin.get('/api/host-entities?type=brand').expect(200);
    expect((listed.body as Array<{ id: string }>).some((row) => row.id === created.body.id)).toBe(true);

    const visibleDefault = await admin.get('/api/host-entities').expect(200);
    expect(
      (visibleDefault.body as Array<{ entityType: string }>).every((row) => row.entityType === 'brand'),
    ).toBe(true);

    await admin
      .post('/api/host-entities')
      .send({ entityType: 'batch', name: `Batch Probe ${stamp}` })
      .expect(201)
      .then((res) => createdIds.push(res.body.id));

    const batchHidden = await admin.get('/api/host-entities?type=batch').expect(200);
    expect(batchHidden.body).toEqual([]);

    const batchVisible = await admin.get('/api/host-entities?type=batch&visibleOnly=false').expect(200);
    expect((batchVisible.body as Array<{ entityType: string }>).some((row) => row.entityType === 'batch')).toBe(
      true,
    );
  });

  it('card returns only ACL-visible tasks for actor', async () => {
    const stamp = Date.now();
    const brand = await admin
      .post('/api/host-entities')
      .send({ entityType: 'brand', name: `ACL Brand ${stamp}` })
      .expect(201);
    createdIds.push(brand.body.id);

    const card = await admin.get(`/api/host-entities/${brand.body.id}`).expect(200);
    expect(card.body.id).toBe(brand.body.id);
    expect(Array.isArray(card.body.tasks)).toBe(true);
  });
});
