import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserHandler } from './commands/create-user.handler';
import { FindUserByEmailHandler } from './queries/find-user-by-email.handler';

@Module({
  imports: [CqrsModule],
  providers: [PrismaService, CreateUserHandler, FindUserByEmailHandler],
  exports: [CqrsModule],
})
export class UsersModule {}
