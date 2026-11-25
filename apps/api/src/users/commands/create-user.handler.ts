import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { Prisma, User } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { usernameBaseFromEmail, usernameCandidate } from '../username';
import { CreateUserCommand } from './create-user.command';

/** Retries after losing a race for a username to a concurrent signup. */
const MAX_CREATE_ATTEMPTS = 5;

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand, User> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ email, password }: CreateUserCommand): Promise<User> {
    const hash = await bcrypt.hash(password, 10);
    const base = usernameBaseFromEmail(email);

    for (let attempt = 1; ; attempt++) {
      const username = await this.findFreeUsername(base);
      try {
        return await this.prisma.user.create({ data: { email, username, password: hash } });
      } catch (err) {
        if (attempt >= MAX_CREATE_ATTEMPTS || !isUsernameConflict(err)) throw err;
      }
    }
  }

  /** First free candidate; `username` is citext, so the lookup is case-insensitive. */
  private async findFreeUsername(base: string): Promise<string> {
    for (let n = 1; ; n++) {
      const candidate = usernameCandidate(base, n);
      const taken = await this.prisma.user.findUnique({
        where: { username: candidate },
        select: { id: true },
      });
      if (!taken) return candidate;
    }
  }
}

function isUsernameConflict(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  return JSON.stringify(err.meta ?? {}).includes('username');
}
