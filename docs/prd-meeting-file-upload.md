# PRD: Meeting File Upload

**Date**: 2026-11-02
**Status**: Draft

## Objective

Enable users to attach files (meeting recordings, transcripts, documents) to a specific meeting for storage and subsequent processing. Files are displayed within the meeting page and are accessible to all participants. ## User Scenarios

- A user opens a meeting and clicks "Upload File" — the file is saved and appears in the meeting's attachment list.
- A user views the list of files for a meeting — they can download any file by clicking on it.
- The meeting owner deletes an attached file — the file is removed from the list and deleted from storage.
- A user attempts to upload a file with an invalid type or size — they receive a clear, understandable error message.

## In Scope

- File uploads via `multipart/form-data` to `POST /meetings/:id/files`.
- Local file storage on disk (path: `uploads/meetings/{meetingId}/{fileId}/{filename}`).
- Saving file metadata to the database (id, meetingId, originalName, mimeType, size, filePath, uploadedAt).
- Retrieving a list of meeting files via `GET /meetings/:id/files`.
- Downloading a file via `GET /meetings/:id/files/:fileId/download` (streamed from disk using NestJS `StreamableFile`).
- Deleting a file (by the meeting owner) via `DELETE /meetings/:id/files/:fileId`.
- A "Files" UI panel within the meeting page, displaying a list of files with their names, sizes, and upload dates.
- An upload button featuring a drag-and-drop zone and a progress bar.
- File-type icons based on MIME type.

## Out of Scope

- Automatic file processing/transcription (planned for a future iteration).
- In-interface file previews (e.g., PDF viewer, video player).
- File versioning.
- Granular access control at the individual file level (access is managed at the meeting level only).
- Support for uploading multiple files simultaneously in a single request.

## Technical Constraints

- **Monorepo**: NestJS backend (`apps/api`), Next.js 15 frontend (`apps/web`). CQRS via CommandBus/QueryBus
- **Prisma + PostgreSQL**: The schema is extended by adding a `MeetingFile` model; a migration is required.
- **Maximum file size**: 100 MB (constrained by Fastify multipart).
- **Allowed file types**: Video (mp4, mov, webm), audio (mp3, m4a, wav), and documents (pdf, docx, xlsx, pptx, txt).
- **Authorization**: Only the meeting owner may delete files; all participants can view and download them (verified via `JwtGuard` + an ownership check).
- **Local storage**: Located in the `uploads/` directory at the root of `apps/api`; the path is configurable via the `UPLOAD_DIR` environment variable (defaults to `./uploads`).
- **Directory creation**: The directory is created automatically upon application startup if it does not already exist.

## Definition of Done

- [x] The `MeetingFile` model has been added to the Prisma schema, and the migration has been applied.
- [x] `POST /meetings/:id/files` accepts a file, saves it to disk, and records its metadata in the database.
- [x] `GET /meetings/:id/files` returns a list of the meeting's files, including their metadata.
- [x] `GET /meetings/:id/files/:fileId/download` streams the file from the disk with the correct `Content-Disposition` header.
- [x] `DELETE /meetings/:id/files/:fileId` removes the file from both the disk and the database. accessible only to the meeting owner
- [x] Uploading a file > 100 MB or an invalid file type returns a 400 status code with an error description
- [x] The meeting page includes a "Files" tab/section with a drag-and-drop area and a list of files
- [x] A progress bar is displayed during file upload
- [x] Clicking on a file triggers a download via the `/download` endpoint
- [x] The file deletion button is visible only to the meeting owner and functions without requiring a page reload
- [x] An E2E test covers the following scenario: upload → display → download → deletion