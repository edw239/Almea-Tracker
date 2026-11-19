import { seedDisplayName } from './seed-name';

describe('seedDisplayName', () => {
  const fallback = 'Эдвард';

  it('keeps a readable Cyrillic name', () => {
    expect(seedDisplayName('Эдуард', fallback)).toBe('Эдуард');
    expect(seedDisplayName('  Эдвард  ', fallback)).toBe('Эдвард');
  });

  it('uses the fallback when the env value is missing or blank', () => {
    expect(seedDisplayName(undefined, fallback)).toBe(fallback);
    expect(seedDisplayName('   ', fallback)).toBe(fallback);
  });

  it('uses the fallback when Cyrillic was replaced by question marks', () => {
    const corrupted = `?\uFFFD?????\uFFFD????`;
    expect(seedDisplayName(corrupted, fallback)).toBe(fallback);
    expect(seedDisplayName('??????', fallback)).toBe(fallback);
    expect(seedDisplayName('Эду\uFFFDард', fallback)).toBe(fallback);
  });
});
