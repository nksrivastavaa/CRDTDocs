import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard } from '@collab/common';
import type { JwtPayload, UserSummary } from '@collab/types';
import { UpdateProfileDto } from './users.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload): Promise<UserSummary> {
    return this.usersService.getProfile(user.sub);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto): Promise<UserSummary> {
    return this.usersService.updateProfile(user.sub, dto);
  }
}
