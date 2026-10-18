import { EPIC_COLORS } from '../../common/constants';

export function epicColor(id: string): string {
  let hash = 0;
  for (const char of id) {
    hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
  }
  return EPIC_COLORS[hash % EPIC_COLORS.length] ?? EPIC_COLORS[0];
}
