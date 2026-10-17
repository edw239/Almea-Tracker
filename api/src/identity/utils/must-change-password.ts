const ALLOWED = new Set([
  'GET /me',
  'GET /auth/me',
  'POST /me/password',
  'POST /auth/logout',
]);

/**
 * Routes a user with mustChangePassword may hit.
 * Prefix `/api` is stripped so tests and Nest share the same table.
 */
export function isAllowedWhileMustChangePassword(method: string, url: string): boolean {
  const pathOnly = url.split('?')[0] ?? '/';
  const withoutTrailing = pathOnly.replace(/\/+$/, '') || '/';
  const path =
    withoutTrailing === '/api'
      ? '/'
      : withoutTrailing.startsWith('/api/')
        ? withoutTrailing.slice(4)
        : withoutTrailing;
  return ALLOWED.has(`${method.toUpperCase()} ${path}`);
}
