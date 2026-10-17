import { NotificationCode, TaskStatus, type Prisma } from '@prisma/client';
import { SYSTEM_LIST_PERSONAL_INBOX } from '../../common/constants';

export const MY_WORK_SCOPES = [
  'default',
  'assigned',
  'owned',
  'watching',
  'mentions',
  'checklist',
  'created',
  'waiting',
  'untriaged',
  'review',
] as const;

export type MyWorkScope = (typeof MY_WORK_SCOPES)[number];

export function parseMyWorkScope(raw: string | undefined): MyWorkScope {
  if (!raw || raw === 'default') {
    return 'default';
  }
  if ((MY_WORK_SCOPES as readonly string[]).includes(raw)) {
    return raw as MyWorkScope;
  }
  return 'default';
}

export function isKnownMyWorkScope(raw: string | undefined): boolean {
  if (raw == null || raw === '') {
    return true;
  }
  return (MY_WORK_SCOPES as readonly string[]).includes(raw);
}

/**
 * Prisma where for My Work / cabinet scopes.
 * Subject is always `userId` from JWT — never from query.
 */
export function buildMyWorkWhere(userId: string, scope: MyWorkScope): Prisma.TaskWhereInput {
  const base: Prisma.TaskWhereInput = {
    deletedAt: null,
    parentTaskId: null,
  };

  switch (scope) {
    case 'assigned':
      return { ...base, assignees: { some: { userId } } };
    case 'owned':
      return { ...base, ownerUserId: userId };
    case 'watching':
      return { ...base, watchers: { some: { userId } } };
    case 'mentions':
      return {
        ...base,
        notifications: {
          some: { userId, code: NotificationCode.TASK_MENTION },
        },
      };
    case 'checklist':
      return {
        ...base,
        checklist: { some: { assigneeUserId: userId } },
      };
    case 'created':
      return { ...base, createdByUserId: userId };
    case 'waiting':
      // Posted by me, still open, at least one other assignee.
      return {
        ...base,
        createdByUserId: userId,
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
        assignees: { some: { NOT: { userId } } },
      };
    case 'untriaged':
      // Ideas in personal inbox: owner, no due, no assignees.
      return {
        ...base,
        ownerUserId: userId,
        dueDate: null,
        assignees: { none: {} },
        list: { systemKey: SYSTEM_LIST_PERSONAL_INBOX, isArchived: false },
      };
    case 'review':
      // Awaiting my acceptance: I created, submitted for review.
      return {
        ...base,
        createdByUserId: userId,
        reviewRequired: true,
        submittedAt: { not: null },
        status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] },
      };
    case 'default':
    default:
      return {
        ...base,
        OR: [
          { ownerUserId: userId },
          { assignees: { some: { userId } } },
          { watchers: { some: { userId } } },
        ],
      };
  }
}
