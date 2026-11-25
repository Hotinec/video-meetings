import 'dotenv/config';
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { MeetingModule } from './meeting/meeting.module';
import { UsersApiModule } from './users/users-api.module';

@Module({
  imports: [AuthModule, MeetingModule, FilesModule, UsersApiModule],
})
export class AppModule {}
