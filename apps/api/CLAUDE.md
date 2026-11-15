# api

NestJS 11 backend application.

## Stack

- NestJS 11
- Express
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
  app.module.ts     # root module — imports AuthModule, MeetingModule
  main.ts           # entry point, listens on :3001, global ValidationPipe
  auth/             # token generation + validation, exports JwtModule; imports UsersModule
    guards/         # JwtAuthGuard — verifies Bearer token, sets req.user
    decorators/     # @CurrentUser() — extracts JwtPayload from req.user
    commands/       # RegisterUserCommand, LoginUserCommand (delegate user ops to UsersModule via buses)
  users/            # user creation + lookup; exports CqrsModule so callers share the bus
    commands/       # CreateUserCommand (hashes password, persists user)
    queries/        # FindUserByEmailQuery
  meeting/          # CRUD meetings, all routes require JWT
    commands/       # CreateMeetingCommand
    queries/        # GetMeetingsQuery, GetMeetingByIdQuery
    dto/            # CreateMeetingDto (title, date)
  prisma/           # PrismaService (global client w/ pg adapter)
test/               # e2e specs (*.e2e-spec.ts)
prisma/             # schema.prisma + migrations (config: prisma7.config.ts)
```

## Modules

### AppModule (`app.module.ts`)

Root module. Imports `AuthModule` and `MeetingModule`. Does not import `UsersModule` directly — it is pulled in transitively via `AuthModule`.

### UsersModule (`users/`)

Owns all user data operations. Has no HTTP surface.

| Concern       | Details                                                                            |
| ------------- | ---------------------------------------------------------------------------------- |
| **Imports**   | `CqrsModule`                                                                       |
| **Providers** | `PrismaService`, `CreateUserHandler`, `FindUserByEmailHandler`                     |
| **Exports**   | `CqrsModule` (so importing modules share the same bus and see registered handlers) |

Commands and queries:

- `CreateUserCommand(email, password)` → hashes password with bcrypt, creates row, returns `User`
- `FindUserByEmailQuery(email)` → `prisma.user.findUnique`, returns `User | null`

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

### Module dependency graph

```
AppModule
├── AuthModule
│   └── UsersModule   (user data; Auth calls its handlers via QueryBus/CommandBus)
└── MeetingModule
    └── AuthModule    (re-used for JwtModule + guards)
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

## Notes

- Part of the `@video-meetings/api` workspace
- Linting and Prettier config inherited from monorepo root
- Decorators enabled: `emitDecoratorMetadata`, `experimentalDecorators`

## File upload

Use this research for it: @docs/research-meeting-file-upload.md
