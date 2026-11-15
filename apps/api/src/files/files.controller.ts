import {
  BadRequestException,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import '@fastify/multipart';
import { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetMeetingByIdQuery } from '../meeting/queries/get-meeting-by-id.query';
import { describeAllowedTypes, isAllowedByNameAndMime } from './allowed-types';
import { UploadFileCommand } from './commands/upload-file.command';
import { FILE_STORAGE, FileStorage, TempFile } from './file-storage';
import { getMaxUploadBytes } from './upload.config';
import { MeetingFileView } from './meeting-file.view';
import { GetMeetingFilesQuery } from './queries/get-meeting-files.query';

@Controller('meetings/:id/files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  @Post()
  async upload(
    @Param('id', ParseIntPipe) meetingId: number,
    @Req() req: FastifyRequest,
  ): Promise<MeetingFileView> {
    // Reject unknown meetings before reading the body, so a bad request writes nothing to disk.
    await this.queryBus.execute(new GetMeetingByIdQuery(meetingId));

    const part = await req.file();
    if (!part) throw new BadRequestException('No file uploaded');

    if (!isAllowedByNameAndMime(part.filename, part.mimetype)) {
      part.file.resume();
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${describeAllowedTypes()}`,
      );
    }

    const tooLarge = () => {
      const mb = Math.floor(getMaxUploadBytes() / (1024 * 1024));
      return new BadRequestException(
        mb >= 1 ? `File is too large. Maximum size is ${mb} MB` : 'File is too large',
      );
    };

    let temp: TempFile;
    try {
      temp = await this.storage.saveTemp(part.file);
    } catch (err) {
      if ((err as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw tooLarge();
      throw err;
    }
    // Depending on the plugin version the limit surfaces as an error or as a truncated stream.
    if (part.file.truncated) {
      await this.storage.remove(temp.path);
      throw tooLarge();
    }

    return this.commandBus.execute(
      new UploadFileCommand(meetingId, temp.path, part.filename, part.mimetype, temp.size),
    );
  }

  @Get()
  list(@Param('id', ParseIntPipe) meetingId: number): Promise<MeetingFileView[]> {
    return this.queryBus.execute(new GetMeetingFilesQuery(meetingId));
  }
}
