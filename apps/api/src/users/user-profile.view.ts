import { User } from '../../generated/prisma/client';

export interface UserProfileView {
  id: number;
  email: string;
  username: string;
  /** `/users/:id/avatar`, or null when the user has no avatar. */
  avatarUrl: string | null;
}

/** The only place a `User` row becomes a response: keeps `password` and `avatarPath` private. */
export function toUserProfileView(user: User): UserProfileView {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    avatarUrl: user.avatarPath ? `/users/${user.id}/avatar` : null,
  };
}
