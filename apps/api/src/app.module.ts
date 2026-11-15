import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { MeetingModule } from './meeting/meeting.module';

@Module({
  imports: [AuthModule, MeetingModule, FilesModule],
})
export class AppModule {}
