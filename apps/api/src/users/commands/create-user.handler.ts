import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { User } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserCommand } from './create-user.command';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ email, password }: CreateUserCommand): Promise<User> {
    const hash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({ data: { email, password: hash } });
  }
}
