import { TaskStatus } from '@prisma/client';
import type { SummaryDayBounds } from '../../identity/utils/zoned-day.util';

export type BucketTaskInput = {
  dueDate: Date | null;
  status: TaskStatus;
  /** Preparation column. Those tasks stay off My Work buckets. */
  inBacklog?: boolean;
};

export type MyWorkBucketKey = 'overdue' | 'today' | 'later' | 'none';

export type BucketedTasks<T extends BucketTaskInput> = Record<MyWorkBucketKey, T[]> & {
  inProgress: number;
};

const CLOSED = new Set<TaskStatus>([TaskStatus.DONE, TaskStatus.CANCELLED]);

function isClosed(status: TaskStatus): boolean {
  return CLOSED.has(status);
}

/** Group open tasks by due buckets in the user's timezone (same rules as GET /me/summary). */
export function bucketTasksByDue<T extends BucketTaskInput>(
  tasks: T[],
  bounds: SummaryDayBounds,
): BucketedTasks<T> {
  const { todayStart, tomorrowStart } = bounds;
  const overdue: T[] = [];
  const today: T[] = [];
  const later: T[] = [];
  const none: T[] = [];
  let inProgress = 0;

  for (const task of tasks) {
    if (task.inBacklog) continue;
    if (task.status === TaskStatus.IN_PROGRESS) {
      inProgress += 1;
    }
    if (isClosed(task.status)) {
      continue;
    }
    if (!task.dueDate) {
      none.push(task);
      continue;
    }
    const due = task.dueDate;
    if (due < todayStart) {
      overdue.push(task);
    } else if (due < tomorrowStart) {
      today.push(task);
    } else {
      later.push(task);
    }
  }

  return { overdue, today, later, none, inProgress };
}
