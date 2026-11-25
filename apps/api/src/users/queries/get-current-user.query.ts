import { Query } from '@nestjs/cqrs';
import { UserProfileView } from '../user-profile.view';

export class GetCurrentUserQuery extends Query<UserProfileView> {
  constructor(public readonly userId: number) {
    super();
  }
}
