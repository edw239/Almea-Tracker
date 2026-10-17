import { Injectable } from '@nestjs/common';
import { NotificationCode, TaskStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import type { Response } from 'express';
import {
  DEFAULT_TIMEZONE,
  NOTIFICATION_SNOOZE_HOURS_DEFAULT,
  PASSWORD_CHANGE_MAX_ATTEMPTS,
  PASSWORD_CHANGE_WINDOW_MS,
  PASSWORD_MIN_LENGTH,
} from '../common/constants';
import { AppError } from '../common/errors';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService, hashPassword } from './auth/auth.service';
import type { AuthUser } from './auth/jwt.strategy';
import type { ChangePasswordDto, PutNotificationSettingsDto, UpdateMeDto } from './dto/me.dto';
import { AttemptLimiter } from './utils/attempt-limiter';
import { isValidIanaTimezone } from './utils/timezone.util';
import { summaryDayBounds } from './utils/zoned-day.util';
import { buildMyWorkWhere, isKnownMyWorkScope, parseMyWorkScope } from '../work-management/utils/my-work-scope.util';
import { bucketTasksByDue } from '../work-management/utils/my-work-buckets.util';

const ALL_NOTIFICATION_CODES = Object.values(NotificationCode);

const PROFILE_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  timezone: true,
  locale: true,
  jobTitle: true,
  createdAt: true,
  passwordChangedAt: true,
  mustChangePassword: true,
} as const;

@Injectable()
export class MeService {
  private readonly passwordAttempts = new AttemptLimiter(
    PASSWORD_CHANGE_MAX_ATTEMPTS,
    PASSWORD_CHANGE_WINDOW_MS,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async getProfile(user: AuthUser) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: PROFILE_SELECT,
    });
    if (!profile) {
      throw AppError.unauthorized();
    }
    const memberships = await this.prisma.taskSpaceMember.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        space: { select: { id: true, name: true, systemKey: true, isSystem: true } },
      },
      orderBy: { space: { name: 'asc' } },
    });
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role,
      timezone: profile.timezone,
      locale: profile.locale,
      jobTitle: profile.jobTitle,
      createdAt: profile.createdAt.toISOString(),
      passwordChangedAt: profile.passwordChangedAt?.toISOString() ?? null,
      mustChangePassword: profile.mustChangePassword,
      memberships: memberships.map((row) => ({
        spaceId: row.space.id,
        spaceName: row.space.name,
        systemKey: row.space.systemKey,
        isSystem: row.space.isSystem,
        role: row.role,
      })),
    };
  }

  async updateProfile(user: AuthUser, dto: UpdateMeDto) {
    if (dto.timezone != null && !isValidIanaTimezone(dto.timezone)) {
      throw AppError.badRequest('Некорректная таймзона (нужен IANA, например Asia/Dubai)');
    }
    if (dto.name === undefined && dto.timezone === undefined && dto.locale === undefined && dto.jobTitle === undefined) {
      throw AppError.badRequest('Нет полей для обновления');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.timezone !== undefined ? { timezone: dto.timezone } : {}),
        ...(dto.locale !== undefined ? { locale: dto.locale } : {}),
        ...(dto.jobTitle !== undefined
          ? { jobTitle: dto.jobTitle === null || dto.jobTitle.trim() === '' ? null : dto.jobTitle.trim() }
          : {}),
      },
      select: PROFILE_SELECT,
    });

    return {
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      timezone: updated.timezone,
      locale: updated.locale,
      jobTitle: updated.jobTitle,
      createdAt: updated.createdAt.toISOString(),
      passwordChangedAt: updated.passwordChangedAt?.toISOString() ?? null,
      mustChangePassword: updated.mustChangePassword,
    };
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto, res: Response) {
    if (!this.passwordAttempts.tryConsume(user.id)) {
      throw AppError.badRequest('Слишком много попыток смены пароля. Подождите 15 минут.');
    }
    if (dto.newPassword.length < PASSWORD_MIN_LENGTH) {
      throw AppError.badRequest(`Пароль: минимум ${PASSWORD_MIN_LENGTH} символов`);
    }
    if (dto.newPassword === dto.currentPassword) {
      throw AppError.badRequest('Новый пароль должен отличаться от текущего');
    }

    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!row) {
      throw AppError.unauthorized();
    }

    const ok = await bcrypt.compare(dto.currentPassword, row.passwordHash);
    if (!ok) {
      throw AppError.unauthorized('Неверный текущий пароль');
    }

    const passwordHash = await hashPassword(dto.newPassword);
    // Floor to second so the new JWT (iat = floor(now/1000)) is not rejected.
    const passwordChangedAt = new Date(Math.floor(Date.now() / 1000) * 1000);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt, mustChangePassword: false },
    });

    this.passwordAttempts.reset(user.id);
    const sessionUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      mustChangePassword: false,
    };
    this.auth.attachSessionCookie(res, await this.auth.signSession(sessionUser));
    return { ok: true as const };
  }

  async getNotificationSettings(user: AuthUser) {
    const row = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        quietHoursFrom: true,
        quietHoursTo: true,
        snoozeHoursDefault: true,
        notificationSettings: { select: { code: true, inApp: true } },
      },
    });
    if (!row) {
      throw AppError.unauthorized();
    }
    const byCode = new Map(row.notificationSettings.map((item) => [item.code, item.inApp]));
    return {
      quietHoursFrom: row.quietHoursFrom,
      quietHoursTo: row.quietHoursTo,
      snoozeHoursDefault: row.snoozeHoursDefault ?? NOTIFICATION_SNOOZE_HOURS_DEFAULT,
      codes: ALL_NOTIFICATION_CODES.map((code) => ({
        code,
        inApp: byCode.get(code) ?? true,
      })),
    };
  }

  async putNotificationSettings(user: AuthUser, dto: PutNotificationSettingsDto) {
    const seen = new Set(dto.codes.map((item) => item.code));
    if (seen.size !== dto.codes.length) {
      throw AppError.badRequest('Дублирующиеся коды уведомлений');
    }
    for (const code of ALL_NOTIFICATION_CODES) {
      if (!seen.has(code)) {
        throw AppError.badRequest(`Неполный набор кодов: нет ${code}`);
      }
    }
    const quietTouched = dto.quietHoursFrom !== undefined || dto.quietHoursTo !== undefined;
    if (quietTouched) {
      if (dto.quietHoursFrom === undefined || dto.quietHoursTo === undefined) {
        throw AppError.badRequest('quietHoursFrom и quietHoursTo задаются вместе');
      }
      if ((dto.quietHoursFrom == null) !== (dto.quietHoursTo == null)) {
        throw AppError.badRequest('quietHoursFrom и quietHoursTo задаются вместе');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (
        dto.quietHoursFrom !== undefined ||
        dto.quietHoursTo !== undefined ||
        dto.snoozeHoursDefault !== undefined
      ) {
        await tx.user.update({
          where: { id: user.id },
          data: {
            ...(dto.quietHoursFrom !== undefined ? { quietHoursFrom: dto.quietHoursFrom } : {}),
            ...(dto.quietHoursTo !== undefined ? { quietHoursTo: dto.quietHoursTo } : {}),
            ...(dto.snoozeHoursDefault !== undefined
              ? { snoozeHoursDefault: dto.snoozeHoursDefault }
              : {}),
          },
        });
      }
      for (const item of dto.codes) {
        await tx.userNotificationSetting.upsert({
          where: { userId_code: { userId: user.id, code: item.code } },
          create: { userId: user.id, code: item.code, inApp: item.inApp },
          update: { inApp: item.inApp },
        });
      }
    });

    return this.getNotificationSettings(user);
  }

  async getSummary(user: AuthUser, now = new Date()) {
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    if (!profile) {
      throw AppError.unauthorized();
    }
    const timezone = profile.timezone || DEFAULT_TIMEZONE;
    const { todayStart, tomorrowStart, weekEnd } = summaryDayBounds(now, timezone);
    const mine = buildMyWorkWhere(user.id, 'default');
    const open = { status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] as TaskStatus[] } };
    const nowInstant = now;

    const [overdue, today, week, inProgress, mineOpen, untriaged, unread] = await Promise.all([
      this.prisma.task.count({
        where: { ...mine, ...open, dueDate: { lt: todayStart } },
      }),
      this.prisma.task.count({
        where: { ...mine, ...open, dueDate: { gte: todayStart, lt: tomorrowStart } },
      }),
      this.prisma.task.count({
        where: { ...mine, ...open, dueDate: { gte: todayStart, lt: weekEnd } },
      }),
      this.prisma.task.count({
        where: { ...mine, status: TaskStatus.IN_PROGRESS },
      }),
      this.prisma.task.count({
        where: { ...mine, ...open },
      }),
      this.prisma.task.count({
        where: buildMyWorkWhere(user.id, 'untriaged'),
      }),
      this.prisma.taskNotification.count({
        where: {
          userId: user.id,
          clearedAt: null,
          readAt: null,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: nowInstant } }],
        },
      }),
    ]);

    return {
      timezone,
      asOf: now.toISOString(),
      overdue,
      today,
      week,
      inProgress,
      mineOpen,
      untriaged,
      unread,
    };
  }

  async getBuckets(user: AuthUser, scopeRaw?: string, now = new Date()) {
    if (!isKnownMyWorkScope(scopeRaw)) {
      throw AppError.badRequest(
        'scope: default|assigned|owned|watching|mentions|checklist|created|waiting|untriaged|review',
      );
    }
    const scope = parseMyWorkScope(scopeRaw);
    const profile = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { timezone: true },
    });
    if (!profile) {
      throw AppError.unauthorized();
    }
    const timezone = profile.timezone || DEFAULT_TIMEZONE;
    const bounds = summaryDayBounds(now, timezone);
    const tasks = await this.prisma.task.findMany({
      where: buildMyWorkWhere(user.id, scope),
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
      include: { assignees: true, list: { select: { id: true, name: true, spaceId: true } } },
    });
    const buckets = bucketTasksByDue(tasks, bounds);
    const serialize = (row: (typeof tasks)[number]) => ({
      ...row,
      dueDate: row.dueDate?.toISOString() ?? null,
      startDate: row.startDate?.toISOString() ?? null,
      completedAt: row.completedAt?.toISOString() ?? null,
      submittedAt: row.submittedAt?.toISOString() ?? null,
      stuckAt: row.stuckAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
    return {
      timezone,
      asOf: now.toISOString(),
      scope,
      overdue: buckets.overdue.map(serialize),
      today: buckets.today.map(serialize),
      later: buckets.later.map(serialize),
      none: buckets.none.map(serialize),
      inProgress: buckets.inProgress,
    };
  }

  async getActivity(user: AuthUser, daysRaw?: string, limitRaw?: string) {
    const days = daysRaw ? Number(daysRaw) : 7;
    const limit = limitRaw ? Number(limitRaw) : 50;
    if (!Number.isInteger(days) || days < 1 || days > 90) {
      throw AppError.badRequest('days: 1..90');
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw AppError.badRequest('limit: 1..100');
    }
    const since = new Date(Date.now() - days * 24 * 3600_000);
    const mine = buildMyWorkWhere(user.id, 'default');

    const [closed, comments, updates, items] = await Promise.all([
      this.prisma.task.count({
        where: { ...mine, completedAt: { gte: since } },
      }),
      this.prisma.taskActivity.count({
        where: { userId: user.id, createdAt: { gte: since }, action: 'COMMENT_ADDED' },
      }),
      this.prisma.taskActivity.count({
        where: { userId: user.id, createdAt: { gte: since }, action: 'UPDATED' },
      }),
      this.prisma.taskActivity.findMany({
        where: { userId: user.id, createdAt: { gte: since } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          taskId: true,
          task: { select: { id: true, title: true } },
        },
      }),
    ]);

    return {
      days,
      since: since.toISOString(),
      closed,
      comments,
      updates,
      items: items.map((row) => ({
        id: row.id,
        action: row.action,
        details: row.details,
        createdAt: row.createdAt.toISOString(),
        taskId: row.taskId,
        taskTitle: row.task.title,
      })),
    };
  }
}
