export interface UserProfileView {
  id: number;
  email: string;
  username: string;
  /** `/users/:id/avatar`, or null when the user has no avatar. */
  avatarUrl: string | null;
}
