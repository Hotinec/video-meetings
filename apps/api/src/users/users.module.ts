import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserHandler } from './commands/create-user.handler';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler';
import { GetCurrentUserHandler } from './queries/get-current-user.handler';

@Module({
  imports: [CqrsModule],
  providers: [PrismaService, CreateUserHandler, FindUserByEmailHandler, GetCurrentUserHandler],
  exports: [CqrsModule],
})
export class UsersModule {}
