import { Body, Controller, Post } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { AuthTokenResult } from './auth.types';
import { LoginUserCommand } from './commands/login-user.command';
import { RegisterUserCommand } from './commands/register-user.command';
import { AuthDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('register')
  register(@Body() dto: AuthDto): Promise<AuthTokenResult> {
    return this.commandBus.execute(new RegisterUserCommand(dto.email, dto.password));
  }

  @Post('login')
  login(@Body() dto: AuthDto): Promise<AuthTokenResult> {
    return this.commandBus.execute(new LoginUserCommand(dto.email, dto.password));
  }
}
