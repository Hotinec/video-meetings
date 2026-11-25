import { Command } from '@nestjs/cqrs';
import { UserProfileView } from '../user-profile.view';

export class UpdateUsernameCommand extends Command<UserProfileView> {
  constructor(
    public readonly userId: number,
    public readonly username: string,
  ) {
    super();
  }
}
