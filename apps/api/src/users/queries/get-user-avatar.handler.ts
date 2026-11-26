import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { getUploadDir } from '../../files/upload.config';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_TYPES } from '../avatar-types';
import { GetUserAvatarQuery, UserAvatarFile } from './get-user-avatar.query';

@QueryHandler(GetUserAvatarQuery)
export class GetUserAvatarHandler implements IQueryHandler<GetUserAvatarQuery, UserAvatarFile> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ userId }: GetUserAvatarQuery): Promise<UserAvatarFile> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarPath: true },
    });
    if (!user?.avatarPath) throw new NotFoundException('Avatar not found');

    const mimeType = AVATAR_TYPES[extname(user.avatarPath).slice(1)];
    if (!mimeType) throw new NotFoundException('Avatar not found');

    const absolutePath = join(getUploadDir(), user.avatarPath);
    try {
      const { size } = await stat(absolutePath);
      return { absolutePath, mimeType, size };
    } catch {
      throw new NotFoundException('Avatar not found');
    }
  }
}
