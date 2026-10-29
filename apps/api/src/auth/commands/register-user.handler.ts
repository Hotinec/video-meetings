import { ConflictException } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import { CreateUserCommand } from '../../users/commands/create-user.command';
import { FindUserByEmailQuery } from '../../users/queries/find-user-by-email.query';
import { AuthTokenResult } from '../auth.types';
import { RegisterUserCommand } from './register-user.command';

@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<RegisterUserCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    private readonly jwt: JwtService,
  ) {}

  async execute({ email, password }: RegisterUserCommand): Promise<AuthTokenResult> {
    const existing = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (existing) throw new ConflictException('Email already registered');

    const user = await this.commandBus.execute(new CreateUserCommand(email, password));

    return { token: this.jwt.sign({ sub: user.id, email: user.email }) };
  }
}
