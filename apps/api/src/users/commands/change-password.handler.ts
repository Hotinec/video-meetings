import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { ChangePasswordCommand } from './change-password.command';

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<ChangePasswordCommand, void> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId, oldPassword, newPassword }: ChangePasswordCommand): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!(await bcrypt.compare(oldPassword, user.password))) {
      throw new UnauthorizedException('Old password is incorrect');
    }
    if (newPassword === oldPassword) {
      throw new BadRequestException('New password must differ from the old password');
    }

    // Same hashing as signup (CreateUserHandler).
    const password = await bcrypt.hash(newPassword, 10);
    // Compare-and-set on the hash we verified, so a concurrent change can't be overwritten.
    const { count } = await this.prisma.user.updateMany({
      where: { id: userId, password: user.password },
      data: { password },
    });
    if (count === 0) throw new UnauthorizedException('Old password is incorrect');
  }
}
