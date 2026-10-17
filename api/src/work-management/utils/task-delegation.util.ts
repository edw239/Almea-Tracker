import { HttpStatus } from '@nestjs/common';
import { AppError, ErrorCode } from '../../common/errors';

/** True when assignees include someone other than the actor and due is absent. */
export function isDelegationWithoutDue(
  actorUserId: string,
  assigneeIds: readonly string[],
  dueDate: string | null | undefined,
): boolean {
  const hasOther = assigneeIds.some((id) => id !== actorUserId);
  if (!hasOther) return false;
  if (dueDate == null) return true;
  return String(dueDate).trim() === '';
}

export function assertDelegationHasDue(
  actorUserId: string,
  assigneeIds: readonly string[],
  dueDate: string | null | undefined,
): void {
  if (isDelegationWithoutDue(actorUserId, assigneeIds, dueDate)) {
    throw new AppError(
      ErrorCode.TASK_DELEGATION_REQUIRES_DUE_DATE,
      'Поручение другому требует срок',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Create assignees: omitted → self (compat); explicit [] → idea without executor.
 */
export function resolveCreateAssigneeIds(
  actorUserId: string,
  assigneeIds: string[] | undefined,
): string[] {
  if (assigneeIds === undefined) {
    return [actorUserId];
  }
  return [...new Set(assigneeIds)];
}
