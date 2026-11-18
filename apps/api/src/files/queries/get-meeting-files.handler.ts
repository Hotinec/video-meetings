import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '../../prisma/prisma.service';
import { MeetingFileView, meetingFileSelect } from '../meeting-file.view';
import { GetMeetingFilesQuery } from './get-meeting-files.query';

@QueryHandler(GetMeetingFilesQuery)
export class GetMeetingFilesHandler implements IQueryHandler<GetMeetingFilesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ meetingId }: GetMeetingFilesQuery): Promise<MeetingFileView[]> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      select: { id: true },
    });
    if (!meeting) throw new NotFoundException(`Meeting ${meetingId} not found`);

    return this.prisma.meetingFile.findMany({
      where: { meetingId },
      orderBy: { uploadedAt: 'desc' },
      select: meetingFileSelect,
    });
  }
}
