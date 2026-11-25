export class GetMeetingFileQuery {
  constructor(
    public readonly meetingId: number,
    public readonly fileId: string,
  ) {}
}
