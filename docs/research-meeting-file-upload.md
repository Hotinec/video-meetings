# Research: Meeting File Upload Approach

**Date:** 2026-11-14 (updated 2026-11-15: decision to use Fastify)
**Reviews:** [plan-prd-meeting-file-upload.md](./plan-prd-meeting-file-upload.md), [prd-meeting-file-upload.md](./prd-meeting-file-upload.md)
**Question:** Is the planned approach (`@fastify/multipart` streaming to disk in NestJS on Fastify, local `uploads/` directory, streamed download) the best one for this project?

## Verdict

**Keep the plan's core approach, with amendments, on Fastify.** Server-side multipart upload streamed to local disk is the right choice for this stage. The project decided to use Fastify, as the PRD specifies, so the API moves from `@nestjs/platform-express` to `@nestjs/platform-fastify` with `@fastify/multipart`. This replaces the earlier multer-based draft of this document.

- It matches the PRD scope: Fastify multipart, local storage, 100 MB cap, a single file per request.
- Migration cost is small. The only Express touchpoints in `apps/api` are `main.ts`, the two e2e bootstraps and a `Request` type import in `jwt-auth.guard.ts`. Controllers, CQRS and Prisma are unaffected.
- There is no cloud account or infrastructure to set up.

Direct-to-S3 uploads with presigned URLs are the stronger pattern at scale (see Alternatives), but they are out of scope for the PRD. The plan should hide storage behind a small interface so the move stays cheap.

The research found several gaps in the plan. They are listed below by priority.

## Alternatives compared

| Approach                                                                 | Fit now            | Notes                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`@fastify/multipart` stream → local disk (plan)**                           | Best               | Simple. Memory stays flat because files stream to disk. Fine for a 100 MB cap. Not horizontally scalable, with no built-in quota or backup.                                                                                                    |
| Buffering the file in memory (`toBuffer()`)                             | Poor               | The whole file is buffered in RAM. 100 concurrent 100 MB uploads would use about 10 GB. Rule out for video.                                                                                                                                    |
| Stream through the API to S3 (`@aws-sdk/lib-storage`) | Later              | Gives durable storage and multipart retries. Needs a bucket and credentials, which the PRD does not include.                                                                                                                                   |
| Presigned URL, direct browser → S3                                       | Later (production) | The API never touches the bytes. This is the standard recommendation for large files. It needs a two-step flow (request URL, then confirm upload), a bucket CORS setup, and a different validation story. It would change the PRD's endpoints. |
| Express + multer `FileInterceptor` (earlier draft)                                         | Not chosen | Works, but the project chose Fastify. `FileInterceptor` is multer-only and does not run on the Fastify adapter. |

Community guides recommend streaming or direct-to-cloud for files above roughly 10 MB. That threshold is a heuristic, not a standard. At 100 MB with a single instance and local disk, disk storage is acceptable. It stops being acceptable once the API runs on more than one instance or on ephemeral containers. Both break local-disk storage.

**Recommendation:** add a thin `FileStorage` provider in the files module, with `save`, `stream` and `remove` methods and a `LocalFileStorage` implementation. The handlers depend on the interface only. This costs about one file now and avoids a rewrite later.

## Gaps in the plan, by priority

### 1. File type validation relies on client-supplied data (Phase 2) — High

The plan says "MIME type plus extension check" check. Both values come from the client. The MIME type is the request's `Content-Type` header and the extension is the filename. Either can be forged. NestJS's built-in `FileTypeValidator` has the same limit: the maintainers confirmed that it checks only the MIME type, not the content.

**Amendment:** add a content check on the saved file, using the [`file-type`](https://www.npmjs.com/package/file-type) package to read magic bytes from the file on disk. Reject the upload and delete the file if it does not match the allowlist. Notes:

- Read the magic bytes from the temp file on disk (or sniff the first chunk while streaming). Never call `toBuffer()` on a video upload.
- docx, xlsx and pptx are zip containers. `file-type` identifies them, but confirm it can tell them apart from a plain zip in a spike.
- `txt` has no magic bytes. Accept it by extension and MIME type only, and serve it as `attachment` with `nosniff` (see item 3).
- Keep the early MIME and extension check as a cheap reject. It is a first filter, not a security control.

### 2. Write to a temp location, then move (Phase 1–2) — High

The plan writes directly to `{UPLOAD_DIR}/meetings/{meetingId}/{fileId}/{filename}`. That path needs a `fileId` and a `meetingId` that has been verified to exist, so writing straight there means the file lands on disk before the 404 check. This leaves a few failure modes:

- A request for an unknown meeting can write a file before the 404.
- A failed validation or DB insert leaves orphan files on disk.
- Phase 2 has to "clean up partial files" separately.

**Amendment:** in the controller, take the stream from `req.file()` and `stream.pipeline` it into `{UPLOAD_DIR}/tmp/{uuid}`. In the command handler, run these steps in order:

1. Verify the meeting exists.
2. Check the magic bytes.
3. Create the DB row.
4. `rename` the file into `meetings/{meetingId}/{fileId}/`.

Wrap the handler in a `try/finally` that removes the temp file on any failure. Add a startup sweep that deletes old files in `tmp/`. `rename` is atomic on the same filesystem, so keep `tmp/` under `UPLOAD_DIR`.

### 3. Do not use the user's filename on disk; harden the download — High

The plan stores sanitized original names on disk. Sanitizing helps, but the safer pattern is to avoid user input in paths entirely.

**Amendment:**

- Store the file as `{UPLOAD_DIR}/meetings/{meetingId}/{fileId}` (or `…/{fileId}/blob`). Keep `originalName` only in the DB, and use it only in `Content-Disposition`. This removes path traversal and Unicode edge cases (the PRD's path format is satisfied in spirit, and the `filePath` column still records it).
- Always send `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` on downloads. Never serve uploads inline. This prevents stored XSS if a disguised HTML or SVG file gets through.
- Build `Content-Disposition` with `filename*=UTF-8''…` (the plan already does) plus an ASCII fallback `filename=`.
- Resolve the final path with `path.resolve` and assert that it starts with `UPLOAD_DIR` before reading or deleting. This is cheap defense in depth.

### 4. Fastify multipart limits and error mapping (Phase 1–2) — Medium

- `@fastify/multipart` enforces `limits.fileSize` and `limits.files: 1`. When the limit is hit, the stream errors with `FST_REQ_FILE_TOO_LARGE` (or sets `truncated`, depending on the `throwFileSizeLimit` option and plugin version). Handle both, delete the temp file, and return `400` with a clear message as the PRD requires. Verify the exact behaviour in the first e2e test.
- Fastify's global `bodyLimit` does not apply to multipart bodies, so the multipart `limits` are the only guard. Set them explicitly.
- Make the limit configurable (`MAX_UPLOAD_BYTES`, default 100 MB) so the e2e test can set it to a few KB. Do not generate a 100 MB buffer in CI.
- Move the size limit into Phase 1. A tracer bullet that accepts unlimited uploads is a risk if it is ever deployed.
- Always consume or destroy the file stream. An unconsumed stream hangs the request.
- Pin and review the `@fastify/multipart` version (`npm ls @fastify/multipart`). I did not check its advisories in this session.

### 5. Non-ASCII filenames — Medium

The busboy parser under `@fastify/multipart` decodes header parameters as latin1 by default, so a name like `Протокол.pdf` can arrive garbled. Set `defParamCharset: 'utf8'` in the plugin's busboy options, or re-decode with `Buffer.from(name, 'latin1').toString('utf8')`. Add a test with a non-ASCII name. This comes from experience with busboy, not from this research's sources, so confirm it against the installed version.

### 6. Browser download and upload through the Next.js auth proxy (Phases 4–5) — Medium, verify early

- A plain `<a href>` cannot send an `Authorization` header. The plan routes through the existing auth proxy in `apps/web/app/api`, which presumably forwards the cookie as a bearer token. That works for downloads, but confirm the proxy **streams** the response rather than buffering a 100 MB body in memory.
- For uploads, check that the proxy streams the request body too, and whether Next.js imposes a request-body size limit on route handlers or middleware in the installed version. I have not verified this. It is the main unknown for Phase 4, so run a short spike in Phase 4 with a 100 MB file before building the panel.
- If the proxy cannot stream large bodies, the options are a Next `rewrites` entry for `/api/meetings/*/files`, or letting the browser call the API directly with a short-lived token. Decide at the spike.

### 7. Delete and DB consistency (Phase 3) — Low

The plan deletes the row and the directory, and a missing disk file must not block the delete. Order matters:

1. Delete the DB row first, so the list is correct immediately.
2. Then remove the disk file, logging any failure.

Orphaned disk files (rare) are harmless compared with rows that point to missing files. The startup sweep from item 2 can also reconcile `meetings/` against the DB later if needed.

### 8. Operational limits to document — Low

These are not blockers, but belong in `apps/api/CLAUDE.md`:

- No virus or malware scanning. Acceptable for the PRD's scope, but note it.
- No per-user or per-meeting quota. Add one if disk usage becomes a concern.
- `uploads/` is not backed up and does not survive container replacement unless it is a mounted volume.
- ``StreamableFile` does not do HTTP `Range` handling. This is fine with no in-browser preview (out of scope), but video seek would need it later.
- Access is "any authenticated user", so file IDs are not secret. The UUID in the path is defense in depth, not authorization.

## Suggested changes to the plan

| Plan item           | Change                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions           | Fastify replaces Express (`@nestjs/platform-fastify`, `@fastify/multipart`), as in the PRD. No `FileInterceptor`.                                                   |
| Phase 1 platform    | Switch `main.ts`, the jwt guard type and both e2e bootstraps, and keep the existing suites green.                                                                   |
| Phase 1 upload task | Stream `req.file()` into `{UPLOAD_DIR}/tmp`, then verify meeting → create row → `rename`. Set the size limit here. Add a `FileStorage` interface with `LocalFileStorage`. |
| Phase 1 config      | Add `MAX_UPLOAD_BYTES` (default 100 MB) next to `UPLOAD_DIR`.                                                                                                       |
| Phase 2 validation  | Early MIME and extension check, then a `file-type` magic-byte check on the temp file. Map `FST_REQ_FILE_TOO_LARGE` to 400.                                          |
| Phase 2 download    | Add `X-Content-Type-Options: nosniff`, an ASCII `filename` fallback and the `UPLOAD_DIR` path-prefix assertion.                                                     |
| Phase 2 tests       | Use the small `MAX_UPLOAD_BYTES` override. Add spoofed-MIME and non-ASCII filename tests.                                                                           |
| Phase 3 delete      | Delete the DB row first, then the disk file.                                                                                                                        |
| Phase 4             | Add a spike: stream a 100 MB file through the Next.js proxy for upload and download, and record the result.                                                         |
| Phase 6 docs        | Update the Stack line in `apps/api/CLAUDE.md` (Fastify) and note the operational limits from item 8.                                                                |

## Open questions

- Is single-instance, local-disk storage acceptable for the first release? If a deployment target with multiple instances or ephemeral disks is already planned, build the S3 implementation of `FileStorage` earlier.
- Should `txt` be accepted without a magic-byte check? Plain text cannot be verified by signature.

## Sources

Findings come mainly from web search result summaries. I did not open the linked pages, and none of them is official NestJS or AWS documentation, so treat them as community guidance.

- [How to Handle File Uploads in Node.js at Scale](https://oneuptime.com/blog/post/2026-01-06-nodejs-file-uploads-scale/markdown)
- [Direct to S3 uploads with presigned URLs (NestJS course)](https://www.coddykit.com/courses/nestjs/direct-to-s3-uploads-with-presigned-urls-9242666)
- [How to Handle File Uploads in NestJS](https://oneuptime.com/blog/post/2026-02-02-nestjs-file-uploads/markdown)
- [File type validation in Multer is not safe (DEV Community), applies equally to any client-supplied MIME type](https://dev.to/ayanabilothman/file-type-validation-in-multer-is-not-safe-3h8l)
- [Secure API file uploads with magic numbers (Transloadit)](https://transloadit.com/devtips/secure-api-file-uploads-with-magic-numbers/)
- [NestJS Unleashed: Validating file signature](https://kinesis-school-of-programming.gitbook.io/nestjs-unleashed/extra-module-4-file-management/file-validation/validating-file-signature)
- [NestJS issue #14876 (FileTypeValidator checks MIME only)](https://github.com/nestjs/nest/issues/14876)
