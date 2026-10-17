import { randomBytes } from 'node:crypto';
import { TEMP_PASSWORD_BYTES } from '../../common/constants';

/** One-time password. Never log the return value. */
export function generateTemporaryPassword(bytes = TEMP_PASSWORD_BYTES): string {
  if (!Number.isInteger(bytes) || bytes < 9) {
    throw new Error('temporary password entropy: at least 9 bytes');
  }
  return randomBytes(bytes).toString('base64url');
}
