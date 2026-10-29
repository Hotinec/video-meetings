import { Command } from '@nestjs/cqrs';
import { AuthTokenResult } from '../auth.types';

export class RegisterUserCommand extends Command<AuthTokenResult> {
  constructor(
    public readonly email: string,
    public readonly password: string,
  ) {
    super();
  }
}
