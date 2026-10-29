import { Query } from '@nestjs/cqrs';
import { User } from '../../../generated/prisma/client';

export class FindUserByEmailQuery extends Query<User | null> {
  constructor(public readonly email: string) {
    super();
  }
}
