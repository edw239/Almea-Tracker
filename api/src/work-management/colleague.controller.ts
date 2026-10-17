import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../identity/auth/current-user.decorator';
import { JwtAuthGuard } from '../identity/auth/jwt-auth.guard';
import type { AuthUser } from '../identity/auth/jwt.strategy';
import { ColleagueService } from './services/colleague.service';

@ApiTags('users')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class ColleagueController {
  constructor(private readonly colleagues: ColleagueService) {}

  @Get(':userId')
  get(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string) {
    return this.colleagues.getProfile(user, userId);
  }
}
