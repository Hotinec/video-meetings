import { Inject, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { FILE_STORAGE, FileStorage } from '../file-storage';
import { MeetingFileView, meetingFileSelect } from '../meeting-file.view';
import { UploadFileCommand } from './upload-file.command';

@CommandHandler(UploadFileCommand)
export class UploadFileHandler implements ICommandHandler<UploadFileCommand> {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async execute(cmd: UploadFileCommand): Promise<MeetingFileView> {
    let storedPath: string | undefined;
    try {
      const meeting = await this.prisma.meeting.findUnique({
        where: { id: cmd.meetingId },
        select: { id: true },
      });
      if (!meeting) throw new NotFoundException(`Meeting ${cmd.meetingId} not found`);

      const fileId = randomUUID();
      storedPath = await this.storage.commit(cmd.tempPath, cmd.meetingId, fileId);
      return await this.prisma.meetingFile.create({
        data: {
          id: fileId,
          meetingId: cmd.meetingId,
          originalName: cmd.originalName,
          mimeType: cmd.mimeType,
          size: cmd.size,
          filePath: storedPath,
        },
        select: meetingFileSelect,
      });
    } catch (err) {
      await this.storage.remove(storedPath ?? cmd.tempPath);
      throw err;
    }
  }
}
