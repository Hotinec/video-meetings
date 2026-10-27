# api

NestJS 11 backend application.

## Stack

- NestJS 11
- Express
- TypeScript 5

## Commands

```bash
npm run dev      # start in watch mode on :3001
npm run build    # compile to dist/
npm run start    # start production server
npm run lint     # lint src/
```

## Structure

```
src/
  app.module.ts  # root module
  main.ts        # entry point, listens on :3001
```

## Notes

- Part of the `@video-meetings/api` workspace
- Linting and Prettier config inherited from monorepo root
- Decorators enabled: `emitDecoratorMetadata`, `experimentalDecorators`
