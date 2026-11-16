# Plan: Meeting File Upload

**PRD:** [docs/prd-meeting-file-upload.md](./prd-meeting-file-upload.md)
**Date:** 2026-11-05

## Decisions Made During Planning

- **HTTP adapter:** the API runs on `@nestjs/platform-express`, so uploads use `FileInterceptor` (multer) with `limits.fileSize` and a `fileFilter`. This replaces the PRD's reference to Fastify multipart. There is no platform migration.
- **Access:** "participants" means any authenticated user (`JwtGuard`). The list and download endpoints need only a valid JWT and an existing meeting. Only the meeting host (`Meeting.hostId`) can delete. There is no participants model.
- **IDs:** `Meeting.id` is an `Int`. `MeetingFile.id` is a UUID, because the disk path `uploads/meetings/{meetingId}/{fileId}/{filename}` needs an unguessable id. Stored filenames are sanitized to prevent path traversal.
- **Meeting page:** `apps/web` has no meeting page yet. Phase 4 adds a minimal `/meetings/[id]` page as the host for the Files panel.

## Implementation Phases

### Phase 1: Tracer bullet — upload and list

**Goal:** A logged-in user can upload one file to a meeting, and it is saved to disk and recorded in the database. The file then shows up in the meeting's file list.
**Impacts:** Backend / Database
**Tasks:**

- [ ] Add the `MeetingFile` model (`id`, `meetingId` FK, `originalName`, `mimeType`, `size`, `filePath`, `uploadedAt`) to `schema.prisma` and create and apply the migration.
- [ ] Add `UPLOAD_DIR` config (default `./uploads`), with the directory created at startup if missing. Add `uploads/` to `.gitignore`.
- [ ] Implement `POST /meetings/:id/files` (`JwtGuard`, `FileInterceptor`, `UploadFileCommand` and handler). It writes to `{UPLOAD_DIR}/meetings/{meetingId}/{fileId}/{filename}` and saves the metadata. Return 404 if the meeting does not exist.
- [ ] Implement `GET /meetings/:id/files` (`GetMeetingFilesQuery` and handler) returning the metadata list, newest first.
- [ ] Write e2e tests in `test/meeting-files.e2e-spec.ts`: upload returns 201 with metadata; the file exists on disk; the list contains it; 401 without a token; 404 for an unknown meeting.

**Definition of Done:** `POST` and `GET /meetings/:id/files` work against a real DB and disk, and the e2e tests pass. The app starts with no pre-existing `uploads/` directory.

### Phase 2: Validation and download

**Goal:** Uploads are restricted by type and size, and files can be downloaded.
**Impacts:** Backend
**Tasks:**

- [ ] Add a multer `fileFilter` allowing mp4, mov, webm, mp3, m4a, wav, pdf, docx, xlsx, pptx and txt (MIME type plus extension check). Add `limits.fileSize` of 100 MB. Map multer errors to a 400 with a clear message, and clean up any partial file on failure.
- [ ] Implement `GET /meetings/:id/files/:fileId/download` (`GetMeetingFileQuery`) that streams from disk with `StreamableFile`, sets `Content-Type`, and sets `Content-Disposition: attachment; filename*=UTF-8''…`. Return 404 if the record or the disk file is missing, or if the file belongs to another meeting.
- [ ] Write e2e tests: a disallowed type returns 400; a file over 100 MB returns 400 (use a small override of the limit via config or a generated buffer); download returns the same bytes and correct headers; 404 cases.

**Definition of Done:** Invalid type or oversized uploads return 400 with a descriptive message and leave nothing on disk. Download returns the exact uploaded bytes with the correct `Content-Disposition`.

### Phase 3: Delete (owner only)

**Goal:** The meeting host can delete a file from storage and the database.
**Impacts:** Backend
**Tasks:**

- [x] Implement `DELETE /meetings/:id/files/:fileId` (`DeleteMeetingFileCommand` and handler). It checks `meeting.hostId === user.id` (403 otherwise) and removes the DB row and the file directory. A missing disk file must not block the DB delete.
- [x] Write e2e tests: the host gets 204 and the file is gone from the list and from disk; a non-host gets 403 and the file remains; an unknown file returns 404.

**Definition of Done:** Only the host can delete. Delete removes both the record and the disk file. The backend part of the PRD is complete (all four endpoints).

### Phase 4: Frontend — Files panel (list, upload, download)

**Goal:** On the meeting page, users see the files list, can upload through a button, and can download by clicking a file.
**Impacts:** Frontend
**Tasks:**

- [x] Add a minimal `/meetings/[id]` page (auth-protected through the existing middleware) with a "Files" section or tab, and add a `lib/meeting-files.ts` API client. It goes through the existing auth proxy in `app/api`.
- [x] Build `FilesPanel`: a list showing name, human-readable size and upload date, with loading, empty and error states.
- [x] Add an "Upload File" button (hidden `<input type="file">`) that posts the file and refreshes the list, shows server validation errors as readable messages, and makes each file link to the `/download` endpoint.
- [x] Add component tests (or a Playwright smoke check) for list rendering, upload success and the error message.

**Definition of Done:** In the browser, a user can upload a file, see it listed, and download it by clicking. Invalid files show a clear error.

### Phase 5: Frontend — drag-and-drop, progress, icons, delete

**Goal:** The remaining UI requirements from the PRD.
**Impacts:** Frontend
**Tasks:**

- [x] Add a drag-and-drop zone around the upload control, with client-side pre-checks for type and size (same limits as the backend).
- [x] Show an upload progress bar (`XMLHttpRequest` `upload.onprogress`, since `fetch` does not report upload progress).
- [x] Add MIME-type file icons (video, audio, PDF, document, spreadsheet, presentation, text, fallback) in `components/icons.tsx`.
- [ ] Show a delete button only to the meeting host. It asks for confirmation, then removes the item from the list without a page reload.
- [ ] Add tests: the drop zone accepts and rejects files, the progress bar appears during upload, the delete button is hidden for non-hosts, and the item is removed after delete.

**Definition of Done:** All frontend items in the PRD's Definition of Done work in the browser.

### Phase 6: End-to-end test and documentation

**Goal:** One E2E test covers the full scenario, and project docs reflect the new state.
**Impacts:** Backend / Frontend
**Tasks:**

- [ ] Write the E2E test for upload → display → download → deletion (API-level in `test/`, plus a Playwright run against the UI if it is available in the project).
- [ ] Update `CLAUDE.md`, `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md` (new module, `UPLOAD_DIR`, `uploads/` directory, new endpoints, new page).

**Definition of Done:** The E2E test passes in a clean run, and lint and build succeed (`npm run lint`, `npm run build`).

## PRD Coverage

| PRD Definition of Done item                    | Phase |
| ---------------------------------------------- | ----- |
| `MeetingFile` model and migration              | 1     |
| `POST /meetings/:id/files`                     | 1     |
| `GET /meetings/:id/files`                      | 1     |
| Download with `Content-Disposition`            | 2     |
| `DELETE` (owner only, disk and DB)             | 3     |
| 400 on invalid type or size over 100 MB        | 2     |
| "Files" tab with drag-and-drop zone and list   | 4, 5  |
| Progress bar                                   | 5     |
| Click on a file triggers download              | 4     |
| Delete button visible only to owner, no reload | 5     |
| E2E: upload → display → download → deletion    | 6     |
