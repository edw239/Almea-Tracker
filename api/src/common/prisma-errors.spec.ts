import { isPrismaUniqueConflict } from './prisma-errors';

describe('isPrismaUniqueConflict', () => {
  it('is false for plain errors', () => {
    expect(isPrismaUniqueConflict(new Error('no'))).toBe(false);
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(false);
  });
});
