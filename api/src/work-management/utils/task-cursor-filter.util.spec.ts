import { AppError } from '../../common/errors';
import { decodeCursor, encodeCursor } from './task-cursor.util';
import { parseFilters, validateFilterGroup } from './task-filter.util';

describe('task-cursor.util', () => {
  it('round-trips cursor', () => {
    const cursor = { position: 1000, createdAt: '2026-08-17T00:00:00.000Z', id: 'abc' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('rejects invalid cursor', () => {
    expect(() => decodeCursor('%%%')).toThrow(AppError);
  });
});

describe('task-filter.util', () => {
  it('accepts allowlisted tree under depth/conditions caps', () => {
    const group = validateFilterGroup({
      op: 'AND',
      children: [
        { field: 'priority', operator: 'is', value: 'HIGH' },
        {
          op: 'OR',
          children: [
            { field: 'due_date', operator: 'lt', value: '2026-08-12T00:00:00.000Z' },
            { field: 'assignee_id', operator: 'is', value: 'u1' },
          ],
        },
      ],
    });
    expect(group.op).toBe('AND');
  });

  it('rejects unknown field', () => {
    expect(() =>
      validateFilterGroup({
        op: 'AND',
        children: [{ field: 'sql', operator: 'is', value: 1 }],
      }),
    ).toThrow(AppError);
  });

  it('parses JSON string', () => {
    const parsed = parseFilters(
      JSON.stringify({ op: 'AND', children: [{ field: 'status', operator: 'is', value: 'OPEN' }] }),
    );
    expect(parsed?.children).toHaveLength(1);
  });
});
