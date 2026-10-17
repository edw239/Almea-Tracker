import { HOST_ENTITY_NAME_MAX_LENGTH } from '../../common/constants';
import { normalizeHostEntityDisplayName, normalizeHostEntityNameKey } from './host-entity-name.util';

describe('host-entity-name.util', () => {
  it('collapses case and spaces into one key', () => {
    expect(normalizeHostEntityNameKey('XLASH')).toBe('xlash');
    expect(normalizeHostEntityNameKey(' xlash ')).toBe('xlash');
    expect(normalizeHostEntityNameKey('X  LASH')).toBe('x lash');
  });

  it('rejects empty or overlong display names', () => {
    expect(() => normalizeHostEntityDisplayName('  ')).toThrow('HOST_ENTITY_NAME_INVALID');
    expect(() =>
      normalizeHostEntityDisplayName('x'.repeat(HOST_ENTITY_NAME_MAX_LENGTH + 1)),
    ).toThrow('HOST_ENTITY_NAME_INVALID');
    expect(normalizeHostEntityDisplayName('  XLASH  ')).toBe('XLASH');
  });
});
