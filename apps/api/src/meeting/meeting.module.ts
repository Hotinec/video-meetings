import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMeetingHandler } from './commands/create-meeting.handler';
import { MeetingController } from './meeting.controller';
import { GetMeetingByIdHandler } from './queries/get-meeting-by-id.handler';
import { GetMeetingsHandler } from './queries/get-meetings.handler';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [MeetingController],
  providers: [CreateMeetingHandler, GetMeetingsHandler, GetMeetingByIdHandler, PrismaService],
})
export class MeetingModule {}
