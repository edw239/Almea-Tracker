import { Injectable } from '@nestjs/common';
import { Prisma, SprintEventType, SprintState, TaskStatus } from '@prisma/client';
import {
  categoryOf,
  StatusReason,
  type StatusColumn,
  type StatusSnapshot,
} from '../utils/task-status.util';

type Tx = Prisma.TransactionClient;

export type StatusCommitInput = {
  taskId: string;
  before: StatusSnapshot | null;
  after: StatusSnapshot;
  columns: StatusColumn[];
  actorUserId: string | null;
  reason: string;
  at?: Date;
  sprintId?: string | null;
  storyPoints?: Prisma.Decimal | number | string | null;
};

@Injectable()
export class TaskStatusService {
  /**
   * Writes the status history row and, for a task in the active sprint,
   * the done/reopened sprint event. The caller persists the task columns.
   */
  async commit(tx: Tx, input: StatusCommitInput): Promise<Date> {
    const at = input.at ?? new Date();
    const before = input.before;
    const changed =
      input.reason === StatusReason.CREATE ||
      !before ||
      before.status !== input.after.status ||
      before.listStatusId !== input.after.listStatusId;
    if (!changed) {
      return at;
    }

    await tx.taskStatusTransition.create({
      data: {
        taskId: input.taskId,
        fromStatus: before?.status ?? null,
        fromListStatusId: before?.listStatusId ?? null,
        fromCategory: before ? categoryOf(input.columns, before.listStatusId, before.status) : null,
        toStatus: input.after.status,
        toListStatusId: input.after.listStatusId,
        toCategory: categoryOf(input.columns, input.after.listStatusId, input.after.status),
        actorUserId: input.actorUserId,
        reason: input.reason,
        createdAt: at,
      },
    });

    if (before && input.sprintId) {
      await this.recordSprintCrossing(tx, {
        sprintId: input.sprintId,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        storyPoints: input.storyPoints ?? null,
        wasDone: before.status === TaskStatus.DONE,
        nowDone: input.after.status === TaskStatus.DONE,
        at,
      });
    }
    return at;
  }

  private async recordSprintCrossing(
    tx: Tx,
    input: {
      sprintId: string;
      taskId: string;
      actorUserId: string | null;
      storyPoints: Prisma.Decimal | number | string | null;
      wasDone: boolean;
      nowDone: boolean;
      at: Date;
    },
  ) {
    if (input.wasDone === input.nowDone) return;
    const sprint = await tx.sprint.findFirst({
      where: { id: input.sprintId, state: SprintState.ACTIVE },
      select: { id: true },
    });
    if (!sprint) return;
    await tx.sprintEvent.create({
      data: {
        sprintId: sprint.id,
        taskId: input.taskId,
        actorUserId: input.actorUserId,
        type: input.nowDone ? SprintEventType.DONE : SprintEventType.REOPENED,
        storyPoints: input.storyPoints === null ? null : input.storyPoints,
        createdAt: input.at,
      },
    });
  }
}
