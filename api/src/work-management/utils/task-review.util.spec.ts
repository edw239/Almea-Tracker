import { isInReviewColumn, resolveReviewRequired } from './task-review.util';

describe('task-review', () => {
  const columns = [
    { id: 'open', name: 'К выполнению' },
    { id: 'run', name: 'В работе' },
    { id: 'rev', name: 'На проверке' },
    { id: 'done', name: 'Готово' },
  ];

  it('detects review column by name', () => {
    expect(isInReviewColumn(columns, 'rev')).toBe(true);
    expect(isInReviewColumn(columns, 'run')).toBe(false);
    expect(isInReviewColumn(columns, null)).toBe(false);
  });

  it('resolveReviewRequired defaults from assignees', () => {
    expect(resolveReviewRequired('a', ['a'])).toBe(false);
    expect(resolveReviewRequired('a', ['b'])).toBe(true);
    expect(resolveReviewRequired('a', ['b'], false)).toBe(false);
    expect(resolveReviewRequired('a', ['a'], true)).toBe(true);
  });
});
