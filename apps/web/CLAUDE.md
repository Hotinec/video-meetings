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
    page.tsx     # home "/" — server component, requires login: shows the API profile's username with an initials avatar, latest 3 + all meetings, Log Out
    profile/     # "/profile" (server component): avatar placeholder, username, read-only email; redirects to /login without a token
    login/       # login page
    signup/      # registration page
    meetings/[id]/ # meeting page (server component): title, date and the Files section
    api/auth/    # route handlers (login, register, logout) that proxy to the API and manage the cookie
    api/users/me/  # proxy route: GET the current user's profile, PATCH to update the username (adds the cookie JWT)
    api/meetings/[id]/files/  # proxy routes: GET list, POST upload (streams the body), [fileId] DELETE, [fileId]/download
  components/    # shared UI (icons, AuthShell, SectionCard, LogoutButton, FilesPanel)
  lib/           # session.ts (cookie + API_URL), auth-proxy.ts, auth.ts (client calls), meetings.ts,
                 # files-proxy.ts (server: forwards to the API with the cookie's JWT), meeting-files.ts (browser client),
                 # file-rules.ts (allowlist + size cap), file-kind.ts (icon kind), meeting-id.ts
  middleware.ts  # redirects to /login when the `token` cookie is missing (matches /, /meetings/* and /profile)
vitest.config.mts, vitest.setup.ts  # test config (jsdom, `@` alias, jest-dom matchers)
```

## Auth

- The API's JWT is stored in an **httpOnly, SameSite=Lax cookie** (`token`, 7 days, `Secure` in production) set by the Next route handlers in `app/api/auth/*`. It is never exposed to client JS or localStorage.
- Server components read the cookie and call the API (`API_URL`, defaults to `http://localhost:3001`) with `Authorization: Bearer`. A 401 from the API sends the user through `GET /api/auth/logout`, which clears the cookie and redirects to `/login`.
- The home page fetches the profile (`lib/users.ts` `fetchProfile`, `GET /users/me`) and shows the username with an initials `Avatar` placeholder. The JWT is only decoded for the user id (`userIdFromToken`), for display decisions; the API verifies the signature.

## Meeting files

- `FilesPanel` (client component, `isHost` prop) lists a meeting's files with loading, empty and error (retry) states. Each row has an icon for its kind (`lib/file-kind.ts` + `FileIcon` in `components/icons.tsx`), the name as a `/download` link, size and date.
- **Upload:** a drag-and-drop zone around an "Upload File" button (hidden `<input type="file">`; the button stays the keyboard path). `lib/file-rules.ts` mirrors the API's allowlist and 100 MB default cap and runs before anything is sent; the API remains the authority. One file at a time. Uploads use `XMLHttpRequest` (`lib/meeting-files.ts`) because `fetch` can't report upload progress; a `role="progressbar"` follows it. Errors show in a `role="alert"` region, success in `role="status"`.
- **Delete:** only the host sees a Delete button. The page compares `meeting.hostId` with the `sub` claim of the JWT (`userIdFromToken`, display only; the API returns 403 for anyone else). Delete asks for inline confirmation (Cancel is focused), then removes the row without reloading; an already-gone file (404) counts as deleted.
- The browser only talks to same-origin `/api/meetings/:id/files` routes (list, upload, `[fileId]` DELETE, `[fileId]/download`). They add the `Authorization` header from the httpOnly cookie, so the JWT never reaches client JS. The upload route streams the multipart body straight to the API.
- Stock HeroUI danger colours fail 4.5:1, so the delete buttons and error text use a darkened `--danger` (see `DANGER_TEXT` in the panel).
- Tests (`npm test`, all mock `fetch` / `XMLHttpRequest`; `src/test/fake-xhr.ts` drives progress by hand): `files-panel.test.tsx` (list, states, upload, progress, drop zone, delete), `meeting-files.test.ts`, `file-rules.test.ts`, `file-kind.test.ts`, `meeting-id.test.ts`.

## Notes

- Part of the `@video-meetings/web` workspace
- Linting and Prettier config inherited from monorepo root

## Definition of Done (frontend changes)

Any frontend change (pages, components, styles, layout, copy, interactions) is only complete after both checks below. Do not report the task as done before then.

1. **Visual inspection via the Playwright MCP.** The dev servers are already running (web `:3002`, API `:3001`), so do not start or restart them; just open the existing URLs. Exercise the change with the Playwright MCP browser tools (`mcp__playwright__browser_*`: navigate, snapshot, click, fill, screenshot, evaluate), not by reading code alone: screenshot it at desktop and mobile (375px) widths, and trigger the relevant states (empty, filled, loading, error, success, keyboard focus).
2. **Verify with the `ui-ux-pro-max` skill.** Invoke the skill and check the change against its rules (accessibility, touch targets, contrast, forms and feedback, responsive layout, motion). Measure contrast rather than eyeballing it. Fix every failure, or list it explicitly as a known gap for the user.

All screenshots save to /screenshot folder
