import { ConflictException, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { toUserProfileView, UserProfileView } from '../user-profile.view';
import { UpdateUsernameCommand } from './update-username.command';

@CommandHandler(UpdateUsernameCommand)
export class UpdateUsernameHandler implements ICommandHandler<
  UpdateUsernameCommand,
  UserProfileView
> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId, username }: UpdateUsernameCommand): Promise<UserProfileView> {
    try {
      // `username` is citext, so uniqueness is case-insensitive.
      const user = await this.prisma.user.update({ where: { id: userId }, data: { username } });
      return toUserProfileView(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') throw new ConflictException('Username is already taken');
        if (err.code === 'P2025') throw new NotFoundException('User not found');
      }
      throw err;
    }
  }
}
