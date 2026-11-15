import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { getUploadDir } from '../upload.config';
import { GetMeetingFileQuery } from './get-meeting-file.query';

export interface MeetingFileDownload {
  absolutePath: string;
  originalName: string;
  mimeType: string;
  size: number;
}

@QueryHandler(GetMeetingFileQuery)
export class GetMeetingFileHandler implements IQueryHandler<GetMeetingFileQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ meetingId, fileId }: GetMeetingFileQuery): Promise<MeetingFileDownload> {
    // Filtering on meetingId as well keeps a file from being fetched through another meeting.
    const file = await this.prisma.meetingFile.findFirst({ where: { id: fileId, meetingId } });
    if (!file) throw new NotFoundException('File not found');

    // Defense in depth: never read outside the upload root.
    const root = getUploadDir();
    const absolutePath = resolve(root, file.filePath);
    if (!absolutePath.startsWith(root + sep)) throw new NotFoundException('File not found');

    const onDisk = await stat(absolutePath).catch(() => null);
    if (!onDisk?.isFile()) throw new NotFoundException('File not found');

    return {
      absolutePath,
      originalName: file.originalName,
      mimeType: file.mimeType,
      size: onDisk.size,
    };
  }
}
