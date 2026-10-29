import { UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { FindUserByEmailQuery } from '../../users/queries/find-user-by-email.query';
import { AuthTokenResult } from '../auth.types';
import { LoginUserCommand } from './login-user.command';

@CommandHandler(LoginUserCommand)
export class LoginUserHandler implements ICommandHandler<LoginUserCommand> {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly jwt: JwtService,
  ) {}

  async execute({ email, password }: LoginUserCommand): Promise<AuthTokenResult> {
    const user = await this.queryBus.execute(new FindUserByEmailQuery(email));
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException();

    return { token: this.jwt.sign({ sub: user.id, email: user.email }) };
  }
}
