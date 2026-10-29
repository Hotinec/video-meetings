import { NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingByIdQuery } from './get-meeting-by-id.query';

@QueryHandler(GetMeetingByIdQuery)
export class GetMeetingByIdHandler implements IQueryHandler<GetMeetingByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: GetMeetingByIdQuery): Promise<Meeting> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id } });
    if (!meeting) throw new NotFoundException(`Meeting ${id} not found`);
    return meeting;
  }
}
