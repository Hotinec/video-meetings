export class UploadFileCommand {
  constructor(
    public readonly meetingId: number,
    public readonly tempPath: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
  ) {}
}
