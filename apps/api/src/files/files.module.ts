import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { DeleteFileHandler } from './commands/delete-file.handler';
import { UploadFileHandler } from './commands/upload-file.handler';
import { FILE_STORAGE } from './file-storage';
import { FilesController } from './files.controller';
import { LocalFileStorage } from './local-file-storage';
import { GetMeetingFileHandler } from './queries/get-meeting-file.handler';
import { GetMeetingFilesHandler } from './queries/get-meeting-files.handler';

@Module({
  imports: [CqrsModule, AuthModule],
  controllers: [FilesController],
  providers: [
    PrismaService,
    UploadFileHandler,
    DeleteFileHandler,
    GetMeetingFilesHandler,
    GetMeetingFileHandler,
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
  ],
})
export class FilesModule {}
