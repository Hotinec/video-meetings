import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { Meeting } from '../../generated/prisma/client';
import { CurrentUser, JwtPayload } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateMeetingCommand } from './commands/create-meeting.command';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { GetMeetingByIdQuery } from './queries/get-meeting-by-id.query';
import { GetMeetingsQuery } from './queries/get-meetings.query';

@Controller('meetings')
@UseGuards(JwtAuthGuard)
export class MeetingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  create(@Body() dto: CreateMeetingDto, @CurrentUser() user: JwtPayload): Promise<Meeting> {
    return this.commandBus.execute(new CreateMeetingCommand(dto.title, dto.date, user.sub));
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload): Promise<Meeting[]> {
    return this.queryBus.execute(new GetMeetingsQuery(user.sub));
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number): Promise<Meeting> {
    return this.queryBus.execute(new GetMeetingByIdQuery(id));
  }
}
