import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Meeting } from '../../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMeetingCommand } from './create-meeting.command';

@CommandHandler(CreateMeetingCommand)
export class CreateMeetingHandler implements ICommandHandler<CreateMeetingCommand> {
  constructor(private readonly prisma: PrismaService) {}

  execute({ title, date, hostId }: CreateMeetingCommand): Promise<Meeting> {
    return this.prisma.meeting.create({ data: { title, date: new Date(date), hostId } });
  }
}
