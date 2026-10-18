import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppError, ErrorCode } from '../../common/errors';
import { rankAfter, rankBetween, RankOrderError } from '../utils/rank.util';

type Tx = Prisma.TransactionClient;

@Injectable()
export class TaskIdentityService {
  async nextKey(tx: Tx, spaceId: string): Promise<string> {
    const space = await tx.taskSpace.update({
      where: { id: spaceId },
      data: { taskSeq: { increment: 1 } },
      select: { key: true, taskSeq: true },
    });
    const key = `${space.key}-${space.taskSeq}`;
    const alias = await tx.taskKeyAlias.findUnique({ where: { key }, select: { key: true } });
    if (alias) {
      throw AppError.conflict(`Ключ ${key} уже сохранён как прежний`);
    }
    return key;
  }

  async nextRank(tx: Tx): Promise<string> {
    const last = await tx.task.findFirst({
      orderBy: { rank: 'desc' },
      select: { rank: true },
    });
    return rankAfter(last?.rank ?? null);
  }

  async rankBetweenTasks(tx: Tx, beforeId: string | null, afterId: string | null): Promise<string> {
    const before = beforeId
      ? await tx.task.findUnique({ where: { id: beforeId }, select: { rank: true } })
      : null;
    const after = afterId
      ? await tx.task.findUnique({ where: { id: afterId }, select: { rank: true } })
      : null;
    if (beforeId && !before) {
      throw AppError.notFound('Сосед по рангу не найден');
    }
    if (afterId && !after) {
      throw AppError.notFound('Сосед по рангу не найден');
    }
    let lower = before?.rank ?? null;
    const upper = after?.rank ?? null;
    try {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const candidate = rankBetween(lower, upper);
        const taken = await tx.task.findUnique({ where: { rank: candidate }, select: { id: true } });
        if (!taken) return candidate;
        lower = candidate;
      }
      throw new RankOrderError();
    } catch (error) {
      if (error instanceof RankOrderError) {
        throw new AppError(
          ErrorCode.RANK_ORDER,
          'Нельзя поставить задачу между этими карточками',
          HttpStatus.CONFLICT,
        );
      }
      throw error;
    }
  }

  async rememberKey(tx: Tx, taskId: string, previousKey: string): Promise<void> {
    await tx.taskKeyAlias.create({
      data: { key: previousKey, taskId },
    });
  }

  async findTaskIdByKey(tx: Prisma.TransactionClient | PrismaServiceLike, key: string): Promise<string | null> {
    const task = await tx.task.findUnique({ where: { key }, select: { id: true } });
    if (task) return task.id;
    const alias = await tx.taskKeyAlias.findUnique({ where: { key }, select: { taskId: true } });
    return alias?.taskId ?? null;
  }
}

type PrismaServiceLike = {
  task: Prisma.TransactionClient['task'];
  taskKeyAlias: Prisma.TransactionClient['taskKeyAlias'];
};
