import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateUsernameCommand } from './commands/update-username.command';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { GetCurrentUserQuery } from './queries/get-current-user.query';
import { UserProfileView } from './user-profile.view';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserProfileView> {
    return this.queryBus.execute(new GetCurrentUserQuery(user.sub));
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserProfileView> {
    return this.commandBus.execute(new UpdateUsernameCommand(user.sub, dto.username));
  }
}
