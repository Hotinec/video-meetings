import { initialsOf } from '@/lib/users';

interface AvatarProps {
  username: string;
  userId?: number;
  /** The API's `avatarUrl`; null/undefined means the user has no avatar. */
  avatarUrl?: string | null;
}

/** The user's avatar image (via the same-origin proxy), or an initials placeholder. */
export function Avatar({ username, userId, avatarUrl }: AvatarProps) {
  const label = `Avatar of ${username}`;
  if (avatarUrl && userId !== undefined) {
    return (
      <img
        src={`/api/users/${userId}/avatar`}
        alt={label}
        className="w-11 h-11 rounded-full shrink-0 object-cover"
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={label}
      className="flex items-center justify-center w-11 h-11 rounded-full shrink-0 text-sm font-semibold text-[var(--accent-foreground)]"
      style={{ background: 'var(--accent)' }}
    >
      <span aria-hidden="true">{initialsOf(username)}</span>
    </div>
  );
}
