import { initialsOf } from '@/lib/users';

/** Initials placeholder shown until the user has an avatar image. */
export function Avatar({ username }: { username: string }) {
  return (
    <div
      role="img"
      aria-label={`Avatar of ${username}`}
      className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 text-sm font-semibold text-[var(--accent-foreground)]"
      style={{ background: 'var(--accent)' }}
    >
      <span aria-hidden="true">{initialsOf(username)}</span>
    </div>
  );
}
