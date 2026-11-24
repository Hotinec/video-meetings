# PRD: User Profile Page and Editing

**Date**: 2026-11-18
**Status**: Draft

## Objective

Give logged-in users a profile page where they can change their username, upload an avatar, and change their password (by confirming the old one). The avatar and username identify the current user across the app, starting with the home page.

## User Scenarios

- User opens the profile page -> sees their current avatar (or a placeholder), username, and email.
- User changes the username and saves -> the new username is persisted and shown on the profile and home page.
- User enters a username that is taken, empty, or invalid -> sees a clear inline error and nothing is saved.
- User selects an image file as a new avatar -> sees a preview, saves, and the avatar appears on the profile and home page.
- User uploads a file of an invalid type or over the size limit -> sees a clear error and the old avatar stays.
- User enters the correct old password and a valid new password -> the password is changed and a success message is shown.
- User enters a wrong old password -> sees an error and the password is unchanged.
- User logs in again after a password change -> only the new password works.
- User without an avatar views the home page -> sees a placeholder (initials/default icon) instead of a broken image.
- Unauthenticated visitor opens the profile page -> is redirected to `/login`.

## In Scope

- Profile page at `/profile`, reachable from the home page (clicking the user's avatar/name).
- Display of avatar, username, and email (email is read-only).
- Editing the username.
- Uploading and replacing an avatar, with a client-side preview before saving.
- Changing the password with old password, new password, and confirm-new-password fields.
- Showing the avatar and username on the home page in place of the plain email for the logged-in user.
- Default avatar placeholder when none is set.
- API endpoints (all except the avatar image require the JWT and only affect the token's own user):

  | Action          | Method and path           | Body                                                  | Success                              | Errors                                      |
  | --------------- | ------------------------- | ----------------------------------------------------- | ------------------------------------ | ------------------------------------------- |
  | Get profile     | `GET /users/me`           | none                                                  | `200` id, email, username, avatarUrl | `401`                                       |
  | Change username | `PATCH /users/me`         | JSON `{ "username": "..." }`                          | `200` updated profile                | `400` invalid, `409` taken                  |
  | Upload avatar   | `POST /users/me/avatar`   | `multipart/form-data`, one image file                 | `200` updated profile                | `400` wrong type or over 5 MB               |
  | Change password | `POST /users/me/password` | JSON `{ "oldPassword": "...", "newPassword": "..." }` | `204`                                | `400` invalid new password, `401` wrong old |
  | Serve avatar    | `GET /users/:id/avatar`   | none                                                  | `200` image stream                   | `404` no avatar                             |

- Next route handlers under `app/api/` proxy these calls and add the `Authorization` header from the httpOnly cookie. The browser never calls the API directly.
- Validation and user-facing error/success messages for each form.

## Out of Scope

- Changing the email address.
- Password reset / "forgot password" by email.
- Avatar cropping, rotation, or other editing in the browser.
- Removing an avatar back to the placeholder (unless trivial; not required).
- Viewing other users' profiles; avatars of meeting participants.
- Account deletion.
- Cloud/CDN storage for avatars.
- Invalidating other active sessions after a password change.

## Technical Constraints

- **Monorepo**: NestJS 11 on Fastify (`apps/api`, CQRS via CommandBus/QueryBus), Next.js 15 App Router (`apps/web`).
- **Data model**: `User` currently has only `id`, `email`, `password`, timestamps. It needs a unique username field and an avatar reference; a Prisma migration is required. Existing users need a sensible username (e.g. derived from email local part, made unique) so the migration does not fail.
- **Auth**: JWT is stored in an httpOnly cookie and the web app proxies API calls through Next route handlers. The profile endpoints must require the JWT and only affect the token's own user.
- **Email display**: The home page currently decodes the email from the JWT. Username and avatar can change after the token is issued, so the home page must get them from the API, not the JWT.
- **Avatar upload**: `multipart/form-data` via Fastify multipart, following the approach in `docs/research-meeting-file-upload.md`. Allowed types: JPEG, PNG, WebP. Max size: 5 MB. Type is verified server-side.
- **Storage**: Local disk under the `UPLOAD_DIR` directory (default `./uploads`), consistent with meeting files. The old avatar file is deleted when replaced.
- **Avatar access**: Avatar images must be viewable by the logged-in user's browser, including in an `<img>` tag.
- **Username rules**: 3–30 characters; letters, digits, `_`, `-`; unique (case-insensitive).
- **Password rules**: Same minimum rules as signup. The new password must differ from the old one. Passwords are hashed the same way as at signup, and never returned or logged.
- **Frontend Definition of Done**: Per `apps/web/CLAUDE.md`, the UI is checked via Playwright at desktop and 375px widths and verified with the `ui-ux-pro-max` skill.
- **Docs**: `CLAUDE.md` and `apps/*/CLAUDE.md` are updated for the new route and endpoints.

## Definition of Done (Acceptance Criteria)

- [ ] The Prisma schema has a unique username and avatar field on `User`, and the migration applies cleanly to a database with existing users (each gets a unique username).
- [ ] `GET /users/me` returns id, email, username, and avatar URL for the authenticated user, and `401` without a valid token.
- [ ] `PATCH /users/me` saves a valid username; returns `400` for invalid input and `409` for a duplicate (case-insensitive).
- [ ] `POST /users/me/avatar` accepts JPEG/PNG/WebP up to 5 MB, stores the file, and updates the user; returns `400` for other types or larger files.
- [ ] Replacing an avatar deletes the previous file from disk.
- [ ] `GET /users/:id/avatar` streams the avatar image with the correct `Content-Type`, and returns `404` when the user has no avatar.
- [ ] `POST /users/me/password` succeeds only when the old password is correct and the new one is valid; returns `400`/`401` with a clear error otherwise, and the stored hash is unchanged on failure.
- [ ] After a password change, login with the old password fails and login with the new password succeeds.
- [ ] A user cannot modify another user's profile through any endpoint.
- [ ] `/profile` redirects unauthenticated visitors to `/login`.
- [ ] `/profile` shows avatar (or placeholder), username, and read-only email, with three forms: username, avatar, password.
- [ ] Each form shows loading, inline validation errors, and a success message; failed submits keep the user's input.
- [ ] The avatar form shows a preview of the selected image before saving.
- [ ] The home page shows the current user's avatar and username (placeholder if no avatar) and links to `/profile`; changes made on the profile are visible after navigating back without re-logging in.
- [ ] The UI is usable at 375px width, forms are keyboard-accessible, and avatar images have alt text.
- [ ] E2E tests cover: update username (success and duplicate), upload avatar (success and invalid type), change password (success and wrong old password).
- [ ] Playwright screenshots at desktop and 375px are saved to `/screenshot`, and the `ui-ux-pro-max` check has no unresolved failures.
- [ ] `CLAUDE.md` files are updated to reflect the new page and endpoints.
