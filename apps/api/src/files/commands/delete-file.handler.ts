import { ForbiddenException, Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { resolve, sep } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../file-storage';
import { getUploadDir } from '../upload.config';
import { DeleteFileCommand } from './delete-file.command';

@CommandHandler(DeleteFileCommand)
export class DeleteFileHandler implements ICommandHandler<DeleteFileCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async execute({ meetingId, fileId, userId }: DeleteFileCommand): Promise<void> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { hostId: true },
    });
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`);
    if (meeting.hostId !== userId) {
      throw new ForbiddenException('Only the meeting host can delete files');
    }

    // Filtering on meetingId as well keeps a file from being deleted through another meeting.
    const file = await this.prisma.meetingFile.findFirst({ where: { id: fileId, meetingId } });
    if (!file) throw new NotFoundException('File not found');

    // Drop the record first: a leftover orphan on disk is harmless, a dangling record is not.
    // deleteMany tolerates a concurrent delete of the same file.
    await this.prisma.meetingFile.deleteMany({ where: { id: file.id } });

    // Defense in depth: never remove anything outside the upload root.
    const root = getUploadDir();
    if (resolve(root, file.filePath).startsWith(root + sep)) {
      await this.storage.remove(file.filePath);
    }
  }
}
