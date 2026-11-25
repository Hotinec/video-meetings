# Video Meetings

NPM monorepo with two applications.

## Structure

```
apps/
  web/   # Next.js 15 (App Router) — runs on :3000
  api/   # NestJS 11 (Fastify) — runs on :3001
```

## Commands

```bash
# Install all dependencies
npm install

# Run both apps
npm run dev

# Run individually
npm run dev:web
npm run dev:api

# Build
npm run build

# Test
npm run test:e2e:api   # API e2e (needs Postgres, wipes the dev DB)
npm run test:web       # web component tests
npm run test:e2e --workspace=@video-meetings/web  # Playwright e2e (needs web :3000 + API :3001 running)

# Lint
npm run lint

# Format
npm run format
```

## Meeting files

Users can attach files to a meeting (video, audio and office documents; 100 MB per file by default).

- **API** (`apps/api/src/files/`): `POST` and `GET /meetings/:id/files`, `GET /meetings/:id/files/:fileId/download`, and `DELETE /meetings/:id/files/:fileId` (meeting host only). Any authenticated user can list, download and upload; only the host can delete. See `apps/api/CLAUDE.md`.
- **Web** (`apps/web`): the `/meetings/[id]` page has a Files panel with upload (button and drag-and-drop, progress bar), file icons, download links and a host-only delete. It talks to same-origin proxy routes under `app/api/meetings/[id]/files` that add the JWT from the httpOnly cookie. See `apps/web/CLAUDE.md`.
- **Storage:** files live on local disk under `UPLOAD_DIR` (default `apps/api/uploads/`, gitignored, created at API startup) as `meetings/{meetingId}/{fileId}`; metadata is in the `MeetingFile` table. `MAX_UPLOAD_BYTES` overrides the size cap. The web app's client-side checks (`apps/web/src/lib/file-rules.ts`) mirror these defaults, so change both together.
- **Product docs:** the PRD and phased plan are in `docs/prd-meeting-file-upload.md` and `docs/plan-prd-meeting-file-upload.md`.

## Tech Stack

- **Monorepo**: NPM workspaces
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: NestJS 11 on Fastify, TypeScript
- **Testing**: Jest + supertest (API e2e), Vitest + Testing Library (web)
- **Linting**: ESLint 9 (flat config), Prettier

## Instructions

- Whenever the project architecture changes (new apps, packages, ports, tech stack, or structural changes), update `CLAUDE.md` and the relevant `apps/*/CLAUDE.md` to reflect the new state.

## Conventions

- Prettier: single quotes, semi, trailing commas, 100-char line width
- ESLint flat config at root (`eslint.config.mjs`) applies to all workspaces
- Workspace package names are scoped: `@video-meetings/web`, `@video-meetings/api`
