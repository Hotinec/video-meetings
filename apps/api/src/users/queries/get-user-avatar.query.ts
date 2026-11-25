import { Query } from '@nestjs/cqrs';

export interface UserAvatarFile {
  absolutePath: string;
  mimeType: string;
  size: number;
}

export class GetUserAvatarQuery extends Query<UserAvatarFile> {
  constructor(public readonly userId: number) {
    super();
  }
}
