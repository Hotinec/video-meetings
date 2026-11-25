import { Controller, Get, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetCurrentUserQuery } from './queries/get-current-user.query';
import { UserProfileView } from './user-profile.view';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserProfileView> {
    return this.queryBus.execute(new GetCurrentUserQuery(user.sub));
  }
}
