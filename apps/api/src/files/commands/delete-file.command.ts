export class DeleteFileCommand {
  constructor(
    public readonly meetingId: number,
    public readonly fileId: string,
    public readonly userId: number,
  ) {}
}
