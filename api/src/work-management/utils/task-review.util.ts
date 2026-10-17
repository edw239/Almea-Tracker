import { LIST_STATUS_NAME_IN_REVIEW } from '../../common/constants';

export function isInReviewColumn(
  columns: Array<{ id: string; name: string }>,
  listStatusId: string | null | undefined,
): boolean {
  if (!listStatusId) return false;
  return columns.some((col) => col.id === listStatusId && col.name === LIST_STATUS_NAME_IN_REVIEW);
}

/** Default review_required: true when someone other than the actor is assignee. */
export function resolveReviewRequired(
  actorUserId: string,
  assigneeIds: readonly string[],
  explicit?: boolean,
): boolean {
  if (explicit === false) return false;
  if (explicit === true) return true;
  return assigneeIds.some((id) => id !== actorUserId);
}
