import { TaskPriority, TaskStatus, UserRole } from '@prisma/client';
import { TaskTemplatesService } from './task-templates.service';

describe('TaskTemplatesService.expandIntoList', () => {
  it('creates root tasks and subtasks in a transaction', async () => {
    const created: Array<{ id: string; title: string }> = [];
    const tx = {
      task: {
        create: jest.fn(async ({ data }: { data: { title: string; parentTaskId: string | null } }) => {
          const row = { id: `t-${created.length + 1}`, title: data.title, parentTaskId: data.parentTaskId };
          created.push(row);
          return { ...row, assignees: [], checklist: [] };
        }),
      },
    };
    const prisma = {
      taskList: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'list-1',
          spaceId: 'space-1',
          systemKey: null,
          isArchived: false,
        }),
      },
      taskTemplate: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'tpl-1',
          isActive: true,
          spaceId: 'space-1',
          listId: null,
          items: [
            {
              title: 'Root',
              priority: TaskPriority.HIGH,
              checklist: [{ text: 'Check' }],
              subtasks: [{ title: 'Child' }],
            },
          ],
        }),
      },
      task: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const spaces = {
      assertCanCreateTaskInList: jest.fn().mockResolvedValue(undefined),
    };
    const statuses = {
      resolveForList: jest.fn().mockResolvedValue([{ id: 'st-open', category: TaskStatus.OPEN }]),
      defaultForCategory: jest.fn().mockReturnValue({ id: 'st-open' }),
    };
    const service = new TaskTemplatesService(prisma as never, spaces as never, statuses as never);
    const result = await service.expandIntoList(
      { id: 'u1', role: UserRole.MEMBER, email: 'a@b.c' },
      'list-1',
      'tpl-1',
    );
    expect(result).toHaveLength(1);
    expect(tx.task.create).toHaveBeenCalledTimes(2);
    expect(created.map((item) => item.title)).toEqual(['Root', 'Child']);
  });
});
