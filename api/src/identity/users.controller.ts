import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './auth/current-user.decorator';
import { GlobalAdminGuard } from './auth/global-admin.guard';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import type { AuthUser } from './auth/jwt.strategy';
import { CreateUserDto, UpdateUserDto } from './dto/users.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiCookieAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@CurrentUser() actor: AuthUser, @Query('includeInactive') includeInactive?: string) {
    const include = includeInactive === 'true' || includeInactive === '1';
    return this.users.list(actor, include);
  }

  @Post()
  @UseGuards(GlobalAdminGuard)
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateUserDto) {
    return this.users.create(actor, dto);
  }

  @Patch(':id')
  @UseGuards(GlobalAdminGuard)
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.users.update(actor, id, dto);
  }

  @Post(':id/reset-password')
  @UseGuards(GlobalAdminGuard)
  resetPassword(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.resetPassword(id);
  }
}
