import { Body, Controller, Get, Patch, Post, Put, Query, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from './auth/current-user.decorator';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import type { AuthUser } from './auth/jwt.strategy';
import { ChangePasswordDto, PutNotificationSettingsDto, UpdateMeDto } from './dto/me.dto';
import { MeService } from './me.service';

@ApiTags('me')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.me.getProfile(user);
  }

  @Patch()
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateMeDto) {
    return this.me.updateProfile(user, dto);
  }

  @Post('password')
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.me.changePassword(user, dto, res);
  }

  @Get('notification-settings')
  getNotificationSettings(@CurrentUser() user: AuthUser) {
    return this.me.getNotificationSettings(user);
  }

  @Put('notification-settings')
  putNotificationSettings(@CurrentUser() user: AuthUser, @Body() dto: PutNotificationSettingsDto) {
    return this.me.putNotificationSettings(user, dto);
  }

  @Get('summary')
  summary(@CurrentUser() user: AuthUser) {
    return this.me.getSummary(user);
  }

  @Get('buckets')
  buckets(@CurrentUser() user: AuthUser, @Query('scope') scope?: string) {
    return this.me.getBuckets(user, scope);
  }

  @Get('activity')
  activity(
    @CurrentUser() user: AuthUser,
    @Query('days') days?: string,
    @Query('limit') limit?: string,
  ) {
    return this.me.getActivity(user, days, limit);
  }
}
