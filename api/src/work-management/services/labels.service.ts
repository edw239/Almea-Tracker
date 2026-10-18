import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { LABEL_NAME_MAX_LENGTH } from '../../common/constants';
import { AppError, ErrorCode } from '../../common/errors';
import type { AuthUser } from '../../identity/auth/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizeHostEntityNameKey } from '../utils/host-entity-name.util';

@Injectable()
export class LabelsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(user: AuthUser, query?: string) {
    void user;
    const nameKey = query?.trim() ? normalizeHostEntityNameKey(query) : undefined;
    return this.prisma.label.findMany({
      where: nameKey ? { nameKey: { contains: nameKey } } : {},
      orderBy: { name: 'asc' },
      take: 20,
    });
  }

  async create(user: AuthUser, nameRaw: string) {
    void user;
    const name = nameRaw.trim().replace(/\s+/g, ' ');
    if (!name || name.length > LABEL_NAME_MAX_LENGTH) {
      throw AppError.badRequest('Название метки: 1–40 символов');
    }
    const nameKey = normalizeHostEntityNameKey(name);
    const brand = await this.prisma.hostEntity.findFirst({
      where: { entityType: 'brand', nameKey, isArchived: false },
      select: { id: true },
    });
    if (brand) {
      throw new AppError(
        ErrorCode.LABEL_MATCHES_BRAND,
        'Такое название уже есть у бренда — используйте поле Бренд',
        HttpStatus.CONFLICT,
      );
    }
    const existing = await this.prisma.label.findUnique({ where: { nameKey } });
    if (existing) return existing;
    return this.prisma.label.create({ data: { name, nameKey } });
  }
}
