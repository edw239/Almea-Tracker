import { HttpStatus } from '@nestjs/common';
import {
  assertDelegationHasDue,
  isDelegationWithoutDue,
  resolveCreateAssigneeIds,
} from './task-delegation.util';
import { ErrorCode } from '../../common/errors';

describe('task-delegation', () => {
  const actor = 'actor-1';
  const other = 'other-1';

  it('personal / empty assignees without due are ok', () => {
    expect(isDelegationWithoutDue(actor, [], undefined)).toBe(false);
    expect(isDelegationWithoutDue(actor, [actor], null)).toBe(false);
    expect(() => assertDelegationHasDue(actor, [actor], undefined)).not.toThrow();
  });

  it('delegation without due is rejected with code', () => {
    expect(isDelegationWithoutDue(actor, [other], undefined)).toBe(true);
    expect(isDelegationWithoutDue(actor, [actor, other], '')).toBe(true);
    expect(isDelegationWithoutDue(actor, [other], '2026-08-20')).toBe(false);
    try {
      assertDelegationHasDue(actor, [other], null);
      fail('expected throw');
    } catch (error) {
      expect(error).toMatchObject({
        code: ErrorCode.TASK_DELEGATION_REQUIRES_DUE_DATE,
        status: HttpStatus.BAD_REQUEST,
      });
    }
  });

  it('resolveCreateAssigneeIds defaults to self when omitted', () => {
    expect(resolveCreateAssigneeIds(actor, undefined)).toEqual([actor]);
    expect(resolveCreateAssigneeIds(actor, [])).toEqual([]);
    expect(resolveCreateAssigneeIds(actor, [other, other, actor])).toEqual([other, actor]);
  });
});
