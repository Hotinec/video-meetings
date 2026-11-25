import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import '@fastify/multipart';
import { FastifyReply, FastifyRequest } from 'fastify';
import { createReadStream } from 'node:fs';
import { once } from 'node:events';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FILE_STORAGE, FileStorage, TempFile } from '../files/file-storage';
import { AVATAR_ALLOWED_DESCRIPTION, isAllowedAvatarMime, MAX_AVATAR_BYTES } from './avatar-types';
import { ChangePasswordCommand } from './commands/change-password.command';
import { UpdateUsernameCommand } from './commands/update-username.command';
import { UploadAvatarCommand } from './commands/upload-avatar.command';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateUsernameDto } from './dto/update-username.dto';
import { GetCurrentUserQuery } from './queries/get-current-user.query';
import { GetUserAvatarQuery, UserAvatarFile } from './queries/get-user-avatar.query';
import { UserProfileView } from './user-profile.view';

const MAX_INT4 = 2147483647;

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  @Get('me')
  me(@CurrentUser() user: JwtPayload): Promise<UserProfileView> {
    return this.queryBus.execute(new GetCurrentUserQuery(user.sub));
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserProfileView> {
    return this.commandBus.execute(new UpdateUsernameCommand(user.sub, dto.username));
  }

  @Post('me/password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.commandBus.execute(
      new ChangePasswordCommand(user.sub, dto.oldPassword, dto.newPassword),
    );
  }

  @Post('me/avatar')
  async uploadAvatar(
    @CurrentUser() user: JwtPayload,
    @Req() req: FastifyRequest,
  ): Promise<UserProfileView> {
    const part = await req.file({ limits: { fileSize: MAX_AVATAR_BYTES } });
    if (!part) throw new BadRequestException('No file uploaded');

    if (!isAllowedAvatarMime(part.mimetype)) {
      part.file.resume();
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${AVATAR_ALLOWED_DESCRIPTION}`,
      );
    }

    const tooLarge = () =>
      new BadRequestException(
        `File is too large. Maximum size is ${MAX_AVATAR_BYTES / (1024 * 1024)} MB`,
      );

    let temp: TempFile;
    try {
      temp = await this.storage.saveTemp(part.file);
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw tooLarge();
      throw err;
    }
    if (part.file.truncated) {
      await this.storage.remove(temp.path);
      throw tooLarge();
    }

    return this.commandBus.execute(new UploadAvatarCommand(user.sub, temp.path));
  }

  @Get(':id/avatar')
  async avatar(
    @Param('id', ParseIntPipe) id: number,
    @Res({ passthrough: true }) res: FastifyReply,
  ): Promise<StreamableFile> {
    // Ids beyond Postgres INT4 can't exist; avoid a Prisma range error (500).
    if (id < 1 || id > MAX_INT4) throw new NotFoundException('Avatar not found');
    const file: UserAvatarFile = await this.queryBus.execute(new GetUserAvatarQuery(id));

    // Open before sending headers: the file may vanish between the stat and here (avatar replaced).
    const stream = createReadStream(file.absolutePath);
    try {
      await once(stream, 'open');
    } catch {
      throw new NotFoundException('Avatar not found');
    }
    res.header('Content-Type', file.mimeType);
    res.header('Content-Length', file.size);
    res.header('X-Content-Type-Options', 'nosniff');
    return new StreamableFile(stream);
  }
}
