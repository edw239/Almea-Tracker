import { isSpaceKey, suggestSpaceKey, withKeySuffix } from './space-key.util';

describe('suggestSpaceKey', () => {
  it('uses the fixed keys for system spaces', () => {
    expect(suggestSpaceKey('Операции', 'ops')).toBe('OPS');
    expect(suggestSpaceKey('Личное', 'personal')).toBe('ME');
    expect(suggestSpaceKey('Host', 'host')).toBe('BR');
  });

  it('transliterates a multi-word Russian name to initials', () => {
    expect(suggestSpaceKey('Лаборатория качества')).toBe('LK');
    expect(isSpaceKey(suggestSpaceKey('Лаборатория качества'))).toBe(true);
  });

  it('keeps a short latin word', () => {
    expect(suggestSpaceKey('Ops')).toBe('OPS');
  });
});

describe('withKeySuffix', () => {
  it('appends a number without exceeding 10 characters', () => {
    expect(withKeySuffix('OPS', 1)).toBe('OPS');
    expect(withKeySuffix('OPS', 2)).toBe('OPS2');
    expect(withKeySuffix('ABCDEFGHIJ', 12)).toBe('ABCDEFGH12');
  });
});
