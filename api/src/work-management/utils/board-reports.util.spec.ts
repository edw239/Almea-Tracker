import { SprintEventType, TaskStatus } from '@prisma/client';
import { cycleTimes, sprintBurndown, velocity } from './board-reports.util';

describe('sprintBurndown', () => {
  it('drops remaining when a committed task is done', () => {
    const start = new Date('2026-10-05T00:00:00.000Z');
    const points = sprintBurndown({
      start,
      end: new Date('2026-10-07T00:00:00.000Z'),
      asOf: new Date('2026-10-06T12:00:00.000Z'),
      metric: 'points',
      businessDays: ['2026-10-05', '2026-10-06', '2026-10-07'],
      events: [
        {
          type: SprintEventType.COMMITTED,
          taskId: 't1',
          storyPoints: 5,
          createdAt: start,
        },
        {
          type: SprintEventType.DONE,
          taskId: 't1',
          storyPoints: 5,
          createdAt: new Date('2026-10-06T10:00:00.000Z'),
        },
      ],
    });
    expect(points[0]?.remaining).toBe(5);
    expect(points[1]?.remaining).toBe(0);
    expect(points[0]?.guideline).toBeGreaterThan(points[2]?.guideline ?? 0);
  });
});

describe('velocity', () => {
  it('sums commitment and completed points', () => {
    const bars = velocity({
      sprints: [
        {
          id: 's1',
          name: 'Спринт 1',
          events: [
            { type: SprintEventType.COMMITTED, taskId: 'a', storyPoints: 3, createdAt: new Date() },
            { type: SprintEventType.CLOSED_DONE, taskId: 'a', storyPoints: 3, createdAt: new Date() },
            { type: SprintEventType.CLOSED_INCOMPLETE, taskId: 'b', storyPoints: 2, createdAt: new Date() },
          ],
        },
      ],
    });
    expect(bars[0]).toEqual({ sprintId: 's1', name: 'Спринт 1', commitment: 3, completed: 3 });
  });
});

describe('cycleTimes', () => {
  it('measures from the first in-progress transition to done', () => {
    const result = cycleTimes({
      window: 10,
      transitions: [
        {
          taskId: 't',
          toCategory: TaskStatus.IN_PROGRESS,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          reason: 'move',
        },
        {
          taskId: 't',
          toCategory: TaskStatus.DONE,
          createdAt: new Date('2026-10-03T00:00:00.000Z'),
          reason: 'move',
        },
      ],
    });
    expect(result.samples[0]?.days).toBe(2);
    expect(result.median).toBe(2);
    expect(result.approximate).toBe(false);
  });

  it('flags synthetic history', () => {
    const result = cycleTimes({
      window: 10,
      transitions: [
        {
          taskId: 't',
          toCategory: TaskStatus.IN_PROGRESS,
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          reason: 'synthetic',
        },
        {
          taskId: 't',
          toCategory: TaskStatus.DONE,
          createdAt: new Date('2026-10-02T00:00:00.000Z'),
          reason: 'move',
        },
      ],
    });
    expect(result.approximate).toBe(true);
  });
});
