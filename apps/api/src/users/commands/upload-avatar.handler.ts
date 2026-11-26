import { BadRequestException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { fromFile } from 'file-type';
import { FILE_STORAGE, FileStorage } from '../../files/file-storage';
import { PrismaService } from '../../prisma/prisma.service';
import { AVATAR_ALLOWED_DESCRIPTION, AVATAR_TYPES } from '../avatar-types';
import { toUserProfileView, UserProfileView } from '../user-profile.view';
import { UploadAvatarCommand } from './upload-avatar.command';

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarHandler implements ICommandHandler<UploadAvatarCommand, UserProfileView> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async execute({ userId, tempPath }: UploadAvatarCommand): Promise<UserProfileView> {
    let storedPath: string | undefined;
    try {
      // Trust the bytes, not the client's header or filename.
      const detected = await fromFile(tempPath);
      const ext = detected?.ext;
      if (!ext || !(ext in AVATAR_TYPES)) {
        throw new BadRequestException(
          `File content is not an allowed image. Allowed types: ${AVATAR_ALLOWED_DESCRIPTION}`,
        );
      }

      const exists = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, avatarPath: true },
      });
      if (!exists) throw new NotFoundException('User not found');

      storedPath = await this.storage.commitAvatar(tempPath, userId, randomUUID(), ext);
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: { avatarPath: storedPath },
      });
      // The DB now points at the new file; the old one is garbage. Best effort.
      if (exists.avatarPath && exists.avatarPath !== storedPath) {
        await this.storage.remove(exists.avatarPath).catch(() => undefined);
      }
      return toUserProfileView(user);
    } catch (err) {
      await this.storage.remove(storedPath ?? tempPath);
      throw err;
    }
  }
}
