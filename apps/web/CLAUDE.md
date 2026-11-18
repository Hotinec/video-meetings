# web

Next.js 15 frontend application.

## Stack

- Next.js 15 (App Router, Turbopack)
- React 19
- TypeScript 5
- Vitest + Testing Library (jsdom) for component tests

## Commands

```bash
npm run dev      # start dev server on :3000
npm run build    # production build
npm run start    # start production server
npm run lint     # lint src/
npm test         # run component/unit tests (vitest)
```

## Structure

```
src/
  app/           # App Router pages and layouts
    page.tsx     # home "/" — server component, requires login: shows email, latest 3 + all meetings, Log Out
    login/       # login page
    signup/      # registration page
    meetings/[id]/ # meeting page (server component): title, date and the Files section
    api/auth/    # route handlers (login, register, logout) that proxy to the API and manage the cookie
    api/meetings/[id]/files/  # proxy routes: GET list, POST upload (streams the body), [fileId]/download
  components/    # shared UI (icons, AuthShell, SectionCard, LogoutButton, FilesPanel)
  lib/           # session.ts (cookie + API_URL), auth-proxy.ts, auth.ts (client calls), meetings.ts,
                 # files-proxy.ts (server: forwards to the API with the cookie's JWT), meeting-files.ts (browser client)
  middleware.ts  # redirects to /login when the `token` cookie is missing (matches / and /meetings/*)
vitest.config.mts, vitest.setup.ts  # test config (jsdom, `@` alias, jest-dom matchers)
```

## Auth

- The API's JWT is stored in an **httpOnly, SameSite=Lax cookie** (`token`, 7 days, `Secure` in production) set by the Next route handlers in `app/api/auth/*`. It is never exposed to client JS or localStorage.
- Server components read the cookie and call the API (`API_URL`, defaults to `http://localhost:3001`) with `Authorization: Bearer`. A 401 from the API sends the user through `GET /api/auth/logout`, which clears the cookie and redirects to `/login`.
- The email shown on the home page is decoded from the JWT payload for display only; the API verifies the signature.

## Meeting files

- `FilesPanel` (client component) lists a meeting's files with loading, empty and error (retry) states, and has an "Upload File" button (hidden `<input type="file">`, `accept` limited to the allowed types). Server validation messages show in a `role="alert"` region; each file name links to `/download`.
- The browser only talks to same-origin `/api/meetings/:id/files` routes. They add the `Authorization` header from the httpOnly cookie, so the JWT never reaches client JS. The upload route streams the multipart body straight to the API, which does all validation.
- Tests: `src/components/files-panel.test.tsx` (list, empty, error + retry, upload success, validation error) and `src/lib/meeting-files.test.ts`. They mock `fetch`.

## Notes

- Part of the `@video-meetings/web` workspace
- Linting and Prettier config inherited from monorepo root

## Definition of Done (frontend changes)

Any frontend change (pages, components, styles, layout, copy, interactions) is only complete after both checks below. Do not report the task as done before then.

1. **Visual inspection via the Playwright MCP.** The dev servers are already running (web `:3002`, API `:3001`), so do not start or restart them; just open the existing URLs. Exercise the change with the Playwright MCP browser tools (`mcp__playwright__browser_*`: navigate, snapshot, click, fill, screenshot, evaluate), not by reading code alone: screenshot it at desktop and mobile (375px) widths, and trigger the relevant states (empty, filled, loading, error, success, keyboard focus).
2. **Verify with the `ui-ux-pro-max` skill.** Invoke the skill and check the change against its rules (accessibility, touch targets, contrast, forms and feedback, responsive layout, motion). Measure contrast rather than eyeballing it. Fix every failure, or list it explicitly as a known gap for the user.

All screenshots save to /screenshot folder
