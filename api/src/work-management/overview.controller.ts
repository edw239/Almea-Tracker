import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { OverviewService } from './services/overview.service';

@ApiTags('overview')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('overview')
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) {
    return this.overview.getOverview(user);
  }
}
