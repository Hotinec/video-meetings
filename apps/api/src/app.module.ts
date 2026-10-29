import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { MeetingModule } from './meeting/meeting.module';

@Module({
  imports: [AuthModule, MeetingModule],
})
export class AppModule {}
