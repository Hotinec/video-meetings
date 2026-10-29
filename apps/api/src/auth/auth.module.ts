import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { LoginUserHandler } from './commands/login-user.handler';
import { RegisterUserHandler } from './commands/register-user.handler';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is required');

@Module({
  imports: [
    CqrsModule,
    JwtModule.register({ secret: jwtSecret, signOptions: { expiresIn: '7d' } }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [RegisterUserHandler, LoginUserHandler],
  exports: [JwtModule],
})
export class AuthModule {}
