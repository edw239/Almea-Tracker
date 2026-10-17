import { TEMP_PASSWORD_BYTES } from '../../common/constants';
import { generateTemporaryPassword } from './temporary-password';

describe('generateTemporaryPassword', () => {
  it('returns base64url of at least 12 chars', () => {
    const password = generateTemporaryPassword();
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(password).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(password, 'base64url').length).toBe(TEMP_PASSWORD_BYTES);
  });

  it('does not repeat across many draws', () => {
    const seen = new Set(Array.from({ length: 80 }, () => generateTemporaryPassword()));
    expect(seen.size).toBe(80);
  });

  it('rejects too-small entropy', () => {
    expect(() => generateTemporaryPassword(8)).toThrow(/entropy/);
  });
});
