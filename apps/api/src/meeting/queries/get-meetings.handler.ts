import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetMeetingsQuery } from './get-meetings.query';

@QueryHandler(GetMeetingsQuery)
export class GetMeetingsHandler implements IQueryHandler<GetMeetingsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ hostId }: GetMeetingsQuery): Promise<Meeting[]> {
    return this.prisma.meeting.findMany({ where: { hostId }, orderBy: { createdAt: 'desc' } });
  }
}
