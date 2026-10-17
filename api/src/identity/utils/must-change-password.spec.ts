import { isAllowedWhileMustChangePassword } from './must-change-password';

describe('isAllowedWhileMustChangePassword', () => {
  it('allows profile, session probe, password change and logout', () => {
    expect(isAllowedWhileMustChangePassword('GET', '/api/me')).toBe(true);
    expect(isAllowedWhileMustChangePassword('GET', '/me')).toBe(true);
    expect(isAllowedWhileMustChangePassword('GET', '/api/auth/me')).toBe(true);
    expect(isAllowedWhileMustChangePassword('POST', '/api/me/password')).toBe(true);
    expect(isAllowedWhileMustChangePassword('POST', '/api/auth/logout')).toBe(true);
  });

  it('blocks work-management and directory', () => {
    expect(isAllowedWhileMustChangePassword('GET', '/api/tasks')).toBe(false);
    expect(isAllowedWhileMustChangePassword('GET', '/api/me/summary')).toBe(false);
    expect(isAllowedWhileMustChangePassword('GET', '/api/users')).toBe(false);
    expect(isAllowedWhileMustChangePassword('PATCH', '/api/me')).toBe(false);
  });
});
