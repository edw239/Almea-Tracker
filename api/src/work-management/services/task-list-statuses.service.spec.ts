import { TaskStatus } from '@prisma/client';
import { TaskListStatusesService } from './task-list-statuses.service';

describe('TaskListStatusesService.defaultForCategory', () => {
  const service = new TaskListStatusesService({} as never);

  it('prefers isDefault in the same category', () => {
    const found = service.defaultForCategory(
      [
        { id: 'a', category: TaskStatus.OPEN, isDefault: false },
        { id: 'b', category: TaskStatus.OPEN, isDefault: true },
        { id: 'c', category: TaskStatus.DONE, isDefault: true },
      ],
      TaskStatus.OPEN,
    );
    expect(found?.id).toBe('b');
  });

  it('falls back to first status in the category', () => {
    const found = service.defaultForCategory(
      [
        { id: 'a', category: TaskStatus.IN_PROGRESS, isDefault: false },
        { id: 'b', category: TaskStatus.DONE, isDefault: true },
      ],
      TaskStatus.IN_PROGRESS,
    );
    expect(found?.id).toBe('a');
  });
});
