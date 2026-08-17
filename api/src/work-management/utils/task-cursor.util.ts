import { CURSOR_PAGE_DEFAULT, CURSOR_PAGE_MAX } from '../../common/constants';
import { AppError } from '../../common/errors';

export type TaskCursor = {
  position: number;
  createdAt: string;
  id: string;
};

export function encodeCursor(cursor: TaskCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined | null): TaskCursor | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as TaskCursor;
    if (
      typeof parsed.position !== 'number' ||
      typeof parsed.createdAt !== 'string' ||
      typeof parsed.id !== 'string'
    ) {
      throw new Error('invalid');
    }
    return parsed;
  } catch {
    throw AppError.badRequest('Невалидный cursor');
  }
}

export function clampPageSize(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return CURSOR_PAGE_DEFAULT;
  return Math.min(CURSOR_PAGE_MAX, Math.max(1, Math.floor(limit)));
}

/** Prisma where fragment: rows after cursor in position ASC, createdAt DESC, id ASC. */
export function afterCursorWhere(cursor: TaskCursor) {
  return {
    OR: [
      { position: { gt: cursor.position } },
      {
        AND: [{ position: cursor.position }, { createdAt: { lt: new Date(cursor.createdAt) } }],
      },
      {
        AND: [
          { position: cursor.position },
          { createdAt: new Date(cursor.createdAt) },
          { id: { gt: cursor.id } },
        ],
      },
    ],
  };
}
