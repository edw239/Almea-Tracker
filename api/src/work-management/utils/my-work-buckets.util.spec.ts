import { TaskStatus } from '@prisma/client';
import { bucketTasksByDue } from './my-work-buckets.util';

describe('bucketTasksByDue', () => {
  const bounds = {
    todayStart: new Date('2026-08-20T00:00:00.000Z'),
    tomorrowStart: new Date('2026-08-21T00:00:00.000Z'),
    weekEnd: new Date('2026-08-27T00:00:00.000Z'),
  };

  it('splits overdue / today / later / none', () => {
    const tasks = [
      { dueDate: new Date('2026-08-19T12:00:00.000Z'), status: TaskStatus.OPEN },
      { dueDate: new Date('2026-08-20T15:00:00.000Z'), status: TaskStatus.IN_PROGRESS },
      { dueDate: new Date('2026-08-25T00:00:00.000Z'), status: TaskStatus.OPEN },
      { dueDate: null, status: TaskStatus.OPEN },
      { dueDate: new Date('2026-08-18T00:00:00.000Z'), status: TaskStatus.DONE },
    ];
    const buckets = bucketTasksByDue(tasks, bounds);
    expect(buckets.overdue).toHaveLength(1);
    expect(buckets.today).toHaveLength(1);
    expect(buckets.later).toHaveLength(1);
    expect(buckets.none).toHaveLength(1);
    expect(buckets.inProgress).toBe(1);
  });
});
