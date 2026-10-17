import { NotificationCode } from '@prisma/client';
import {
  buildMyWorkWhere,
  isKnownMyWorkScope,
  parseMyWorkScope,
} from './my-work-scope.util';

describe('my-work-scope', () => {
  const userId = '11111111-1111-1111-1111-111111111111';

  it('parseMyWorkScope defaults unknown to default', () => {
    expect(parseMyWorkScope(undefined)).toBe('default');
    expect(parseMyWorkScope('')).toBe('default');
    expect(parseMyWorkScope('watching')).toBe('watching');
    expect(parseMyWorkScope('nope')).toBe('default');
  });

  it('isKnownMyWorkScope rejects garbage', () => {
    expect(isKnownMyWorkScope(undefined)).toBe(true);
    expect(isKnownMyWorkScope('assigned')).toBe(true);
    expect(isKnownMyWorkScope('hack')).toBe(false);
  });

  it('default is owner OR assignee OR watcher', () => {
    expect(buildMyWorkWhere(userId, 'default')).toEqual({
      deletedAt: null,
      parentTaskId: null,
      OR: [
        { ownerUserId: userId },
        { assignees: { some: { userId } } },
        { watchers: { some: { userId } } },
      ],
    });
  });

  it('assigned / owned / watching', () => {
    expect(buildMyWorkWhere(userId, 'assigned').assignees).toEqual({ some: { userId } });
    expect(buildMyWorkWhere(userId, 'owned').ownerUserId).toBe(userId);
    expect(buildMyWorkWhere(userId, 'watching').watchers).toEqual({ some: { userId } });
  });

  it('mentions uses TASK_MENTION notifications', () => {
    expect(buildMyWorkWhere(userId, 'mentions').notifications).toEqual({
      some: { userId, code: NotificationCode.TASK_MENTION },
    });
  });

  it('checklist filters by checklist assignee', () => {
    expect(buildMyWorkWhere(userId, 'checklist').checklist).toEqual({
      some: { assigneeUserId: userId },
    });
  });

  it('created / waiting / untriaged / review', () => {
    expect(buildMyWorkWhere(userId, 'created').createdByUserId).toBe(userId);
    const waiting = buildMyWorkWhere(userId, 'waiting');
    expect(waiting.createdByUserId).toBe(userId);
    expect(waiting.assignees).toEqual({ some: { NOT: { userId } } });
    const untriaged = buildMyWorkWhere(userId, 'untriaged');
    expect(untriaged).toEqual({
      deletedAt: null,
      parentTaskId: null,
      ownerUserId: userId,
      dueDate: null,
      assignees: { none: {} },
      list: { systemKey: 'personal-inbox', isArchived: false },
    });
    const review = buildMyWorkWhere(userId, 'review');
    expect(review).toMatchObject({
      createdByUserId: userId,
      reviewRequired: true,
      submittedAt: { not: null },
    });
  });
});
