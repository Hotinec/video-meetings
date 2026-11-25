# api

NestJS 11 backend application.

## Stack

- NestJS 11
- Fastify (`@nestjs/platform-fastify` 11, `@fastify/multipart`)
- Prisma 7 (PostgreSQL via `@prisma/adapter-pg`, client generated to `generated/prisma`)
- CQRS (`@nestjs/cqrs` 11)
- JWT auth (`@nestjs/jwt` 11 — v12 is ESM-only and breaks Jest), bcrypt, class-validator
- TypeScript 5

## Commands

```bash
npm run dev      # start in watch mode on :3001
npm run build    # compile to dist/
npm run start    # start production server
npm run lint     # lint src/
npm run test:e2e # run all e2e tests (see Testing section below)
```

## Testing

All tests are e2e (no unit tests). They boot the full NestJS app against a real PostgreSQL database and use `supertest` to make HTTP requests.

**Test suites** (`test/*.e2e-spec.ts`):

- `auth.e2e-spec.ts` — registration and login endpoints
- `meetings.e2e-spec.ts` — meeting CRUD endpoints (JWT-protected)
- `users.e2e-spec.ts` — `GET /users/me` (200 fields, 401 without/invalid token, 404 for a deleted user) and `PATCH /users/me` (200, 400 invalid, 409 duplicate with different case, 401)
- `user-username-migration.e2e-spec.ts` — applies the migrations to a scratch database (`video_meetings_migration_test`, created and dropped by the test), inserts users, runs the username migration and checks the backfilled usernames are unique
- `user-avatar.e2e-spec.ts` — `POST /users/me/avatar` (valid jpg/png/webp, wrong type, spoofed content, over 5 MB, no file, 401; temporary `UPLOAD_DIR`)
- `meeting-files.e2e-spec.ts` — file upload, list, download and delete (uses a temporary `UPLOAD_DIR`)
- `meeting-files-flow.e2e-spec.ts` — the PRD's end-to-end story in one test: upload → list → download → delete (host only), plus the 400 cases

**Prerequisites:**

1. Postgres must be running — start it with Docker Compose from the monorepo root:
   ```bash
   docker compose up -d
   ```
2. `apps/api/.env` must exist with `DATABASE_URL` and `JWT_SECRET`:
   ```
   DATABASE_URL="postgresql://postgres:postgres@localhost:5435/video_meetings"
   JWT_SECRET="change-me-in-production"
   ```

**Run all tests** (from `apps/api/` or the monorepo root):

```bash
npm run test:e2e
```

Tests run serially (`--runInBand`) and each suite cleans up its own database rows in `beforeAll`/`afterAll` hooks. Timeout per test is 30 s.

## Structure

```
src/
  app.module.ts     # root module — imports AuthModule, MeetingModule, FilesModule, UsersApiModule
  app.setup.ts      # shared app setup (multipart limits, ValidationPipe) used by main.ts and e2e
  main.ts           # entry point (Fastify adapter), listens on :3001, CORS, calls setupApp
  auth/             # token generation + validation, exports JwtModule; imports UsersModule
    guards/         # JwtAuthGuard — verifies Bearer token, sets req.user
    decorators/     # @CurrentUser() — extracts JwtPayload from req.user
    commands/       # RegisterUserCommand, LoginUserCommand (delegate user ops to UsersModule via buses)
  users/            # user creation + lookup; exports CqrsModule so callers share the bus
    commands/       # CreateUserCommand (hashes password, persists user), UpdateUsernameCommand
    queries/        # FindUserByEmailQuery, GetCurrentUserQuery
    users.controller.ts  # GET + PATCH /users/me (JWT) — wired by UsersApiModule
  meeting/          # CRUD meetings, all routes require JWT
    commands/       # CreateMeetingCommand
    queries/        # GetMeetingsQuery, GetMeetingByIdQuery
    dto/            # CreateMeetingDto (title, date)
  files/            # meeting file upload/list/download/delete (/meetings/:id/files), JWT-protected
    commands/       # UploadFileCommand, DeleteFileCommand
    queries/        # GetMeetingFilesQuery, GetMeetingFileQuery
    allowed-types.ts      # allowlist: extension -> MIME types + content-derived extensions
    content-disposition.ts # attachment header with ASCII fallback + UTF-8 filename*
  prisma/           # PrismaService (global client w/ pg adapter)
test/               # e2e specs (*.e2e-spec.ts)
uploads/            # runtime upload root (UPLOAD_DIR; gitignored): meetings/{meetingId}/{fileId}, tmp/ for in-flight uploads
prisma/             # schema.prisma + migrations (config: prisma7.config.ts). `User.username` is unique, case-insensitive (Postgres `citext` extension, created by the migration); `User.avatarPath` is nullable (path relative to UPLOAD_DIR). The migration backfills usernames with the same rules as `users/username.ts` — change both together
```

## Modules

### AppModule (`app.module.ts`)

Root module. Imports `AuthModule`, `MeetingModule` and `FilesModule`. Does not import `UsersModule` directly — it is pulled in transitively via `AuthModule`.

### UsersModule (`users/`)

Owns all user data operations. Has no HTTP surface.

| Concern       | Details                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| **Imports**   | `CqrsModule`                                                                       |
| **Providers** | `PrismaService`, `CreateUserHandler`, `FindUserByEmailHandler`                     |
| **Exports**   | `CqrsModule` (so importing modules share the same bus and see registered handlers) |

Commands and queries:

- `CreateUserCommand(email, password)` → hashes password with bcrypt, derives a unique username from the email local part (`users/username.ts`: lowercased, invalid chars → `_`, padded to 3, max 30, numeric suffix on collision; retries on a concurrent-signup race), creates row, returns `User`
- `UpdateUsernameCommand(userId, username)` → updates only the token user's username (DTO: 3–30 chars, letters/digits/`_`/`-`, else 400; `409` if taken, case-insensitive via citext); returns the profile view (both handlers build it with `toUserProfileView` in `users/user-profile.view.ts`, the single place a `User` row becomes a response)
- `FindUserByEmailQuery(email)` → `prisma.user.findUnique`, returns `User | null`
- `GetCurrentUserQuery(userId)` → `{ id, email, username, avatarUrl }` (`avatarUrl` is `/users/:id/avatar` or null; password/avatarPath never exposed), `NotFoundException` if the user is gone

- `UploadAvatarCommand(userId, tempPath)` → handled in `UsersApiModule` (needs file storage). Detects the real type of the temp file with `file-type` (JPEG, PNG, WebP only; else 400), moves it to `UPLOAD_DIR/avatars/{userId}/{uuid}.{ext}`, sets `User.avatarPath`, returns the profile view. The temp/new file is removed on failure. Replacing does not yet delete the previous file.

`POST /users/me/avatar` (multipart, field `file`): early MIME check (`image/jpeg|png|webp`), 5 MB cap via a per-request `req.file({ limits })` override (400 when exceeded, independent of `MAX_UPLOAD_BYTES`), 400 without a file, 401 without a token. Only the token user's avatar can be changed.

`UsersApiModule` (`users/users-api.module.ts`) holds `UsersController` (`GET` and `PATCH /users/me`, `POST /users/me/avatar`, `JwtAuthGuard`). It is separate from `UsersModule` because `AuthModule` imports `UsersModule` and the controller needs `AuthModule`'s JWT.

### AuthModule (`auth/`)

Owns token generation and validation. Has no direct Prisma dependency — delegates all user persistence and lookup to `UsersModule` via the CQRS buses.

| Concern       | Details                                                      |
| ------------- | ------------------------------------------------------------ |
| **Imports**   | `CqrsModule`, `JwtModule`, `UsersModule`                     |
| **Providers** | `RegisterUserHandler`, `LoginUserHandler`                    |
| **Exports**   | `JwtModule` (consumed by `MeetingModule` for `JwtAuthGuard`) |

Commands and their cross-module bus calls:

- `RegisterUserCommand(email, password)` → queries `FindUserByEmailQuery`, executes `CreateUserCommand`, signs JWT
- `LoginUserCommand(email, password)` → queries `FindUserByEmailQuery`, verifies password with bcrypt, signs JWT

Guards and decorators (not bus-based, used directly by other modules):

- `guards/JwtAuthGuard` — verifies Bearer token via `JwtService`, sets `req.user`
- `decorators/@CurrentUser()` — extracts `JwtPayload` (`{ sub, email }`) from `req.user`

### MeetingModule (`meeting/`)

Owns meeting CRUD. All routes are protected by `JwtAuthGuard`.

| Concern       | Details                                                                                |
| ------------- | -------------------------------------------------------------------------------------- |
| **Imports**   | `CqrsModule`, `AuthModule`                                                             |
| **Providers** | `PrismaService`, `CreateMeetingHandler`, `GetMeetingsHandler`, `GetMeetingByIdHandler` |

Commands and queries:

- `CreateMeetingCommand(title, date, hostId)` → creates meeting row, returns `Meeting`
- `GetMeetingsQuery(hostId)` → returns `Meeting[]` ordered by `createdAt desc`
- `GetMeetingByIdQuery(id)` → returns `Meeting` or throws `NotFoundException`

### FilesModule (`files/`)

Owns meeting file upload, listing, download and delete. All routes are protected by `JwtAuthGuard`.

| Concern       | Details                                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------------- |
| **Imports**   | `CqrsModule`, `AuthModule`                                                                                            |
| **Providers** | `PrismaService`, `UploadFileHandler`, `DeleteFileHandler`, `GetMeetingFilesHandler`, `GetMeetingFileHandler`, storage |

- `POST /meetings/:id/files` — checks the meeting exists (404), streams the file to `UPLOAD_DIR/tmp`, then `UploadFileCommand` moves it to `meetings/{meetingId}/{fileId}` and saves the row. The temp file is removed on any failure.
- `GET /meetings/:id/files` — `GetMeetingFilesQuery` returns metadata, newest first. `filePath` is never exposed.
- `GET /meetings/:id/files/:fileId/download` — `GetMeetingFileQuery` (404 for an unknown file, another meeting's file, a missing disk file, or a path outside `UPLOAD_DIR`). Streams with `StreamableFile`; always `Content-Disposition: attachment` plus `X-Content-Type-Options: nosniff`. No `Range` support.
- `DELETE /meetings/:id/files/:fileId` — `DeleteFileCommand`, host only (`meeting.hostId === user.id`). 204 on success; 404 for an unknown meeting, unknown file, or a file of another meeting; 403 for a non-host. Removes the DB row, then the disk file; a missing disk file, a disk error (logged) or a path outside `UPLOAD_DIR` never blocks the DB delete.

Upload validation (all failures are 400 and leave nothing on disk): an early name + MIME check on client data (mp4, mov, webm, mp3, m4a, wav, pdf, docx, xlsx, pptx, txt), then a magic-byte check of the temp file with `file-type`. `txt` has no signature, so it must have none detected. Oversize uploads are rejected whether the plugin reports an error or a truncated stream.

`file-type` is pinned to v16 (last CommonJS release); newer versions are ESM-only and break Jest.

### Module dependency graph

```
AppModule
├── AuthModule
│   └── UsersModule   (user data; Auth calls its handlers via QueryBus/CommandBus)
├── MeetingModule
│   └── AuthModule    (re-used for JwtModule + guards)
└── FilesModule
    └── AuthModule    (guards; calls GetMeetingByIdQuery via QueryBus)
```

## CQRS pattern

All business operations go through `@nestjs/cqrs`. The rule is simple:

- anything that **writes** state → `CommandBus` + `CommandHandler`
- anything that **reads** state → `QueryBus` + `QueryHandler`

### Flow

```
HTTP request
  → Controller
    → CommandBus.execute(new XxxCommand(...))   # write
    → QueryBus.execute(new XxxQuery(...))       # read
      → Handler (ICommandHandler / IQueryHandler)
        → PrismaService
```

### Adding a new operation

**Write (command):**

```
src/<module>/commands/
  do-something.command.ts      # plain class, constructor holds input data
  do-something.handler.ts      # @CommandHandler(DoSomethingCommand), execute()
```

Register the handler in the module's `providers` array, then call it from the controller:

```ts
this.commandBus.execute(new DoSomethingCommand(arg1, arg2));
```

**Read (query):**

```
src/<module>/queries/
  get-something.query.ts       # plain class, constructor holds filter params
  get-something.handler.ts     # @QueryHandler(GetSomethingQuery), execute()
```

```ts
this.queryBus.execute(new GetSomethingQuery(hostId));
```

### Module wiring

Every module that uses the bus must import `CqrsModule` and list all handlers in `providers`:

```ts
@Module({
  imports: [CqrsModule],
  providers: [DoSomethingHandler, GetSomethingHandler],
})
```

## Configuration

- `UPLOAD_DIR` — upload root, default `./uploads` (gitignored, created at startup)
- `MAX_UPLOAD_BYTES` — per-file size cap, default 100 MB

## Notes

- Part of the `@video-meetings/api` workspace
- Linting and Prettier config inherited from monorepo root
- Decorators enabled: `emitDecoratorMetadata`, `experimentalDecorators`

## File upload

Use this research for it: @docs/research-meeting-file-upload.md
