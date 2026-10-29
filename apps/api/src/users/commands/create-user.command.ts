import { Command } from '@nestjs/cqrs';
import { User } from '../../../generated/prisma/client';

export class CreateUserCommand extends Command<User> {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
