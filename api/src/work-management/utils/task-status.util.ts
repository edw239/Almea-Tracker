import { TaskStatus } from '@prisma/client';
import { AppError } from '../../common/errors';

export const StatusReason = {
  CREATE: 'create',
  MOVE: 'move',
  UPDATE: 'update',
  BULK: 'bulk',
  STATUS_DELETED: 'status_deleted',
  SPRINT_START: 'sprint_start',
  SYNTHETIC: 'synthetic',
} as const;

export type StatusReasonValue = (typeof StatusReason)[keyof typeof StatusReason];

export type StatusColumn = {
  id: string;
  name: string;
  category: TaskStatus;
  isDefault: boolean;
  isBacklog?: boolean;
};

export type StatusSnapshot = {
  status: TaskStatus;
  listStatusId: string | null;
  completedAt: Date | null;
};

export function normalizeStatusName(name: string): string {
  return name.trim().toLocaleLowerCase('ru-RU');
}

export function isBacklogColumn(columns: StatusColumn[], listStatusId: string | null | undefined): boolean {
  if (!listStatusId) return false;
  return columns.some((column) => column.id === listStatusId && column.isBacklog === true);
}

export function resolveDualStatus(
  task: StatusSnapshot,
  columns: StatusColumn[],
  input: { status?: TaskStatus; listStatusId?: string },
): StatusSnapshot & { changed: boolean } {
  let status = task.status;
  let listStatusId = task.listStatusId;
  let completedAt = task.completedAt;

  if (input.listStatusId) {
    const column = columns.find((item) => item.id === input.listStatusId);
    if (!column) {
      throw AppError.notFound('Статус списка не найден');
    }
    listStatusId = column.id;
    status = column.category;
  } else if (input.status) {
    status = input.status;
    listStatusId =
      columns.find((item) => item.category === status && item.isDefault)?.id ??
      columns.find((item) => item.category === status)?.id ??
      listStatusId;
  }

  if (status === TaskStatus.DONE && task.status !== TaskStatus.DONE) {
    completedAt = new Date();
  } else if (status !== TaskStatus.DONE) {
    completedAt = null;
  }

  const changed = status !== task.status || listStatusId !== task.listStatusId;
  return { status, listStatusId, completedAt, changed };
}

export function categoryOf(columns: StatusColumn[], listStatusId: string | null, fallback: TaskStatus): TaskStatus {
  return columns.find((column) => column.id === listStatusId)?.category ?? fallback;
}
