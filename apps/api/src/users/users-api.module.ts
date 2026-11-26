import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FILE_STORAGE } from '../files/file-storage';
import { LocalFileStorage } from '../files/local-file-storage';
import { PrismaService } from '../prisma/prisma.service';
import { UploadAvatarHandler } from './commands/upload-avatar.handler';
import { GetUserAvatarHandler } from './queries/get-user-avatar.handler';
import { UsersController } from './users.controller';
import { UsersModule } from './users.module';

/** HTTP surface for users. Separate from UsersModule because AuthModule already imports it. */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [UsersController],
  providers: [
    PrismaService,
    UploadAvatarHandler,
    GetUserAvatarHandler,
    { provide: FILE_STORAGE, useClass: LocalFileStorage },
  ],
})
export class UsersApiModule {}
