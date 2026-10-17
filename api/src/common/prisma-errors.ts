import { Prisma } from '@prisma/client';

export function isPrismaUniqueConflict(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
