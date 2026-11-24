# Plan: User Profile Page and Editing

**PRD:** docs/prd-user-profile-editing.md
**Date:** 2026-11-18

## Implementation Phases

### Phase 1: Profile data model and `GET /users/me` (tracer bullet)

**Goal:** The home page shows the username from the API instead of the email decoded from the JWT. This covers the whole path: DB, API, Next proxy, UI.
**Impacts:** Database / Backend / Frontend
**Tasks:**

- [ ] Prisma: add a unique, case-insensitive `username` and a nullable `avatarPath` (avatar reference) to `User`. The migration backfills existing users with a unique username derived from the email local part, with a numeric suffix on collisions. Also set a username at signup.
- [ ] API: add `GET /users/me` (JWT required) through a CQRS query. It returns id, email, username, avatarUrl (`/users/:id/avatar`, or null when no avatar).
- [ ] Web: add a Next route handler `app/api/users/me` that proxies the call and adds `Authorization` from the httpOnly cookie.
- [ ] Web: the home page fetches the profile from the API, not the JWT, and shows the username (with an initials placeholder) in place of the email.
- [ ] Tests: API e2e for `GET /users/me` (200 with fields, 401 without a token). Run the migration against a DB with existing users and check that the usernames are unique.

**Definition of Done:** The migration applies cleanly to a DB with existing users. `GET /users/me` returns the correct fields and 401 without a token. The home page shows the username from the API.

### Phase 2: `/profile` page and username editing

**Goal:** A logged-in user opens `/profile` from the home page, sees their data, and changes their username.
**Impacts:** Backend / Frontend
**Tasks:**

- [ ] API: add `PATCH /users/me` through a CQRS command. Rules: 3–30 characters, letters, digits, `_`, `-`; `400` if invalid, `409` if taken (case-insensitive). It only affects the token's user.
- [ ] Web: add a proxy route handler for `PATCH /api/users/me`. Add the `/profile` page, which redirects unauthenticated visitors to `/login` and shows the avatar placeholder, username, and read-only email.
- [ ] Web: add the username form with loading state, inline validation errors, a success message, and kept input on failure. Make the home page avatar/name block link to `/profile`. The home page shows the new username after navigating back without a re-login.
- [ ] Tests: API e2e for a valid update, invalid input (400), a duplicate with different case (409), and no token (401). A Playwright e2e for username update (success and duplicate) and the `/profile` redirect for an unauthenticated visitor.

**Definition of Done:** A username change is saved and shown on `/profile` and the home page. Invalid and duplicate values show a clear inline error and nothing is saved. `/profile` redirects unauthenticated visitors to `/login`.

### Phase 3: Avatar backend (upload and serve)

**Goal:** The API can store, replace, and serve a user's avatar.
**Impacts:** Backend
**Tasks:**

- [ ] API: add `POST /users/me/avatar` (Fastify multipart, following `docs/research-meeting-file-upload.md`). It allows JPEG, PNG, WebP up to 5 MB, and verifies the type on the server (not only from the header). It stores the file under `UPLOAD_DIR` and updates the user. It returns `400` for a wrong type or a file over 5 MB.
- [ ] API: when an avatar is replaced, delete the previous file from disk. If the DB update fails, do not leave an orphan file.
- [ ] API: add `GET /users/:id/avatar`, which streams the image with the correct `Content-Type` and returns `404` when the user has no avatar. Make `avatarUrl` in the profile response point to it.
- [ ] Tests: API e2e for a valid upload of each type, a wrong type (400), an oversize file (400), replacement deleting the old file, `GET` with the correct `Content-Type`, `404` with no avatar, and `401` without a token on upload. Check that a user cannot change another user's avatar.

**Definition of Done:** The avatar upload, replace, and serve criteria from the PRD pass through the API tests, with the old file removed on replacement.

### Phase 4: Avatar UI

**Goal:** The user uploads an avatar with a preview and sees it on the profile and home page.
**Impacts:** Frontend
**Tasks:**

- [ ] Web: add a proxy route handler for the avatar upload (multipart pass-through). Add a route handler that serves the avatar image from the cookie-authenticated proxy, so it works in an `<img>` tag.
- [ ] Web: add the avatar form on `/profile`. It shows a client-side preview of the selected file and checks type and size before sending. It has loading state, inline errors, and a success message. The old avatar stays on an error.
- [ ] Web: show the avatar (with alt text, and the initials placeholder when there is none) on `/profile` and the home page. The new avatar is visible after navigating back without a re-login.
- [ ] Tests: Playwright e2e for avatar upload (success) and for an invalid type (error shown, old avatar kept).

**Definition of Done:** A user selects an image, sees the preview, saves it, and the avatar appears on the profile and home page. An invalid file shows an error and keeps the old avatar. No broken image appears for users without an avatar.

### Phase 5: Password change

**Goal:** The user changes their password by confirming the old one.
**Impacts:** Backend / Frontend
**Tasks:**

- [ ] API: add `POST /users/me/password` through a CQRS command. It checks the old password (`401` if wrong), validates the new password with the signup rules, requires that it differs from the old one (`400` otherwise), hashes it the same way as at signup, and returns `204`. The hash is unchanged on failure. The password is never returned or logged.
- [ ] Web: add a proxy route handler for the password change. Add the password form on `/profile` with old, new, and confirm-new fields, a client-side check that the two new values match, loading state, inline errors, a success message, and kept input on failure.
- [ ] Tests: API e2e for success, wrong old password (401), an invalid or unchanged new password (400), the hash unchanged on failure, and login with the old password failing and with the new one succeeding after a change. Playwright e2e for password change (success and wrong old password).

**Definition of Done:** The password changes only with the correct old password. After a change, only the new password logs in. Errors are clear and the stored hash is unchanged on failure.

### Phase 6: UI verification and documentation

**Goal:** Close the PRD's Definition of Done for UI quality, security, and docs.
**Impacts:** Frontend / Backend / Docs
**Tasks:**

- [ ] Check at desktop and 375px with Playwright. Fix layout issues, check keyboard access of all forms, and check alt text on avatar images. Save screenshots to `/screenshot`.
- [ ] Run the `ui-ux-pro-max` check on `/profile` and the home page, and fix all failures.
- [ ] Add an API test that none of the `/users/me` endpoints can modify another user (the user comes only from the token). Run the full API and e2e suites.
- [ ] Update `CLAUDE.md`, `apps/api/CLAUDE.md`, and `apps/web/CLAUDE.md` for the `/profile` route, the new endpoints, the data model changes, and the avatar storage.

**Definition of Done:** All the PRD's acceptance criteria are checked. Screenshots at both widths are in `/screenshot`, the `ui-ux-pro-max` check has no unresolved failures, all tests pass, and the `CLAUDE.md` files are up to date.
