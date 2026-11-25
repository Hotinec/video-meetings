/**
 * Mirrors the API's username rules (`apps/api/src/users/username.ts` and
 * `dto/update-username.dto.ts`); the server stays the authority. Change both together.
 */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export const USERNAME_PATTERN = new RegExp(
  `^[A-Za-z0-9_-]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`,
);

export const USERNAME_RULE_MESSAGE = `Use ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters: letters, digits, _ or -.`;
