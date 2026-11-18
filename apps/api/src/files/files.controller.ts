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
import { UploadFileCommand } from './commands/upload-file.command';
import { FILE_STORAGE, FileStorage } from './file-storage';
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

    const temp = await this.storage.saveTemp(part.file);
    return this.commandBus.execute(
      new UploadFileCommand(meetingId, temp.path, part.filename, part.mimetype, temp.size),
    );
  }

  @Get()
  list(@Param('id', ParseIntPipe) meetingId: number): Promise<MeetingFileView[]> {
    return this.queryBus.execute(new GetMeetingFilesQuery(meetingId));
  }
}
