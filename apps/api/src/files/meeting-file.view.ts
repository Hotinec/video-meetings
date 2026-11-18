import { Prisma } from '../../generated/prisma/client';

/** Public metadata of a meeting file. `filePath` stays internal. */
export const meetingFileSelect = {
  id: true,
  meetingId: true,
  originalName: true,
  mimeType: true,
  size: true,
  uploadedAt: true,
} satisfies Prisma.MeetingFileSelect;

export type MeetingFileView = Prisma.MeetingFileGetPayload<{ select: typeof meetingFileSelect }>;
