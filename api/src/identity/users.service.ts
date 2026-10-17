import { Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { AppError } from '../common/errors';
import { isPrismaUniqueConflict } from '../common/prisma-errors';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from './auth/auth.service';
import type { AuthUser } from './auth/jwt.strategy';
import type { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { generateTemporaryPassword } from './utils/temporary-password';

const PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  jobTitle: true,
  isActive: true,
} as const;

type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  jobTitle: string | null;
  isActive: boolean;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  list(actor: AuthUser, includeInactive = false) {
    const showInactive = includeInactive && actor.role === 'GLOBAL_ADMIN';
    return this.prisma.user.findMany({
      where: showInactive ? {} : { isActive: true },
      select: PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  async create(actor: AuthUser, dto: CreateUserDto) {
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.name,
          role: dto.role ?? UserRole.MEMBER,
          jobTitle: dto.jobTitle === undefined ? undefined : dto.jobTitle,
          passwordHash,
          mustChangePassword: true,
          createdByUserId: actor.id,
        },
        select: PUBLIC_SELECT,
      });
      return { ...toPublic(user), temporaryPassword };
    } catch (error) {
      if (isPrismaUniqueConflict(error)) {
        throw AppError.conflict('Пользователь с таким email уже есть');
      }
      throw error;
    }
  }

  async update(actor: AuthUser, userId: string, dto: UpdateUserDto) {
    if (dto.name === undefined && dto.role === undefined && dto.jobTitle === undefined && dto.isActive === undefined) {
      throw AppError.badRequest('Нет полей для обновления');
    }

    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, isActive: true },
    });
    if (!target) {
      throw AppError.notFound();
    }

    if (dto.isActive === false && target.id === actor.id) {
      throw AppError.badRequest('Нельзя деактивировать собственную учётную запись');
    }
    if (dto.role === UserRole.MEMBER && target.id === actor.id && target.role === UserRole.GLOBAL_ADMIN) {
      throw AppError.badRequest('Нельзя снять с себя роль администратора');
    }

    const demotingAdmin =
      target.role === UserRole.GLOBAL_ADMIN &&
      target.isActive &&
      (dto.isActive === false || dto.role === UserRole.MEMBER);
    if (demotingAdmin) {
      const activeAdmins = await this.prisma.user.count({
        where: { role: UserRole.GLOBAL_ADMIN, isActive: true },
      });
      if (activeAdmins <= 1) {
        throw AppError.conflict('Нельзя снять последнего администратора');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: PUBLIC_SELECT,
    });
    return toPublic(updated);
  }

  async resetPassword(userId: string) {
    const target = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!target) {
      throw AppError.notFound();
    }
    const temporaryPassword = generateTemporaryPassword();
    const passwordHash = await hashPassword(temporaryPassword);
    const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt,
        mustChangePassword: true,
      },
      select: PUBLIC_SELECT,
    });
    return { ...toPublic(user), temporaryPassword };
  }
}

function toPublic(user: PublicUser): PublicUser {
  return user;
}
