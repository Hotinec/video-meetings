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

# Lint
npm run lint

# Format
npm run format
```

## Tech Stack

- **Monorepo**: NPM workspaces
- **Frontend**: Next.js 15, React 19, TypeScript
- **Backend**: NestJS 11 on Fastify, TypeScript
- **Linting**: ESLint 9 (flat config), Prettier

## Instructions

- Whenever the project architecture changes (new apps, packages, ports, tech stack, or structural changes), update `CLAUDE.md` and the relevant `apps/*/CLAUDE.md` to reflect the new state.

## Conventions

- Prettier: single quotes, semi, trailing commas, 100-char line width
- ESLint flat config at root (`eslint.config.mjs`) applies to all workspaces
- Workspace package names are scoped: `@video-meetings/web`, `@video-meetings/api`
