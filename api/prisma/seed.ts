import { PrismaClient, TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import {
  DEFAULT_STATUSES,
  POSITION_STEP,
  SYSTEM_LIST_PERSONAL_INBOX,
  SYSTEM_SPACE_PERSONAL,
} from '../src/common/constants';

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

async function seedStatuses(spaceId: string, listId: string | null) {
  const existing = await prisma.taskListStatus.count({
    where: listId ? { listId } : { spaceId, listId: null },
  });
  if (existing > 0) {
    return;
  }
  await prisma.taskListStatus.createMany({
    data: DEFAULT_STATUSES.map((item) => ({
      spaceId,
      listId,
      name: item.name,
      color: item.color,
      order: item.order,
      category: item.category,
      isDefault: item.isDefault,
    })),
  });
}

async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'ceo@almea.local').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) {
    throw new Error('SEED_ADMIN_PASSWORD must be set and at least 8 characters');
  }
  const name = process.env.SEED_ADMIN_NAME ?? 'Эдуард';

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.upsert({
    where: { email },
    update: { name, role: UserRole.GLOBAL_ADMIN, passwordHash },
    create: { email, name, role: UserRole.GLOBAL_ADMIN, passwordHash },
  });

  const personal = await prisma.taskSpace.upsert({
    where: { systemKey: SYSTEM_SPACE_PERSONAL },
    update: {},
    create: {
      name: 'Личное',
      description: 'System space. Личные задачи без доменной сущности.',
      isSystem: true,
      systemKey: SYSTEM_SPACE_PERSONAL,
    },
  });
  await seedStatuses(personal.id, null);

  const inbox = await prisma.taskList.upsert({
    where: { spaceId_systemKey: { spaceId: personal.id, systemKey: SYSTEM_LIST_PERSONAL_INBOX } },
    update: {},
    create: {
      spaceId: personal.id,
      name: 'Входящие',
      systemKey: SYSTEM_LIST_PERSONAL_INBOX,
      position: POSITION_STEP,
    },
  });
  await seedStatuses(personal.id, inbox.id);

  const ops = await prisma.taskSpace.upsert({
    where: { systemKey: 'ops' },
    update: {},
    create: {
      name: 'Операции',
      description: 'Компания, лаборатория, фабрика.',
      systemKey: 'ops',
    },
  });
  await prisma.taskSpaceMember.upsert({
    where: { spaceId_userId: { spaceId: ops.id, userId: user.id } },
    update: {},
    create: { spaceId: ops.id, userId: user.id, role: 'OWNER' },
  });
  await seedStatuses(ops.id, null);

  const strategy = await prisma.taskList.upsert({
    where: { spaceId_systemKey: { spaceId: ops.id, systemKey: 'strategy' } },
    update: {},
    create: {
      spaceId: ops.id,
      name: 'Стратегия 2030',
      systemKey: 'strategy',
      position: POSITION_STEP,
    },
  });
  await seedStatuses(ops.id, strategy.id);

  const inboxInProgress = await prisma.taskListStatus.findFirst({
    where: { listId: inbox.id, category: TaskStatus.IN_PROGRESS },
  });
  const strategyInProgress = await prisma.taskListStatus.findFirst({
    where: { listId: strategy.id, category: TaskStatus.IN_PROGRESS },
  });

  const existingTasks = await prisma.task.count({ where: { deletedAt: null } });
  if (existingTasks === 0) {
    await prisma.task.create({
      data: {
        listId: inbox.id,
        ownerUserId: user.id,
        title: 'Апдейт совету директоров — Q3',
        description: 'Выручка брендов, загрузка завода, статус патента.',
        status: TaskStatus.IN_PROGRESS,
        listStatusId: inboxInProgress?.id ?? null,
        priority: TaskPriority.HIGH,
        position: POSITION_STEP,
        assignees: { create: { userId: user.id } },
      },
    });
    await prisma.task.create({
      data: {
        listId: strategy.id,
        ownerUserId: user.id,
        title: 'Стратегия 2030: утвердить KPI лаборатории',
        description: 'Патенты в работе, time-to-stable, доля SKU с доказательной базой.',
        status: TaskStatus.IN_PROGRESS,
        listStatusId: strategyInProgress?.id ?? null,
        priority: TaskPriority.URGENT,
        position: POSITION_STEP,
        domainEntityType: 'brand',
        domainEntityId: 'xlash',
        domainLabel: 'XLASH',
        assignees: { create: { userId: user.id } },
      },
    });
  }

  await prisma.taskSpace.upsert({
    where: { systemKey: 'host' },
    update: {},
    create: {
      name: 'Host',
      description: 'System space для entity-lists.',
      isSystem: true,
      systemKey: 'host',
    },
  });

  const weekly = await prisma.taskTemplate.findFirst({
    where: { spaceId: ops.id, name: 'Еженедельный ops-пакет' },
  });
  if (!weekly) {
    await prisma.taskTemplate.create({
      data: {
        spaceId: ops.id,
        name: 'Еженедельный ops-пакет',
        createdBy: user.id,
        items: [
          {
            title: 'Стендап производства',
            priority: 'HIGH',
            checklist: [{ text: 'План смены' }, { text: 'Блокеры' }],
            subtasks: [{ title: 'Зафиксировать риски' }],
          },
          {
            title: 'Проверка складских остатков',
            priority: 'MEDIUM',
          },
          {
            title: 'Апдейт статусов брендов',
            priority: 'MEDIUM',
            checklist: [{ text: 'XLASH' }, { text: 'Прочие SKU' }],
          },
        ],
      },
    });
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
