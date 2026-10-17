import { HOST_ENTITY_NAME_MAX_LENGTH } from '../../common/constants';

/** Canonical key for unique (entityType, nameKey): lower(trim), collapse spaces. */
export function normalizeHostEntityNameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function normalizeHostEntityDisplayName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length > HOST_ENTITY_NAME_MAX_LENGTH) {
    throw new Error('HOST_ENTITY_NAME_INVALID');
  }
  return trimmed;
}
