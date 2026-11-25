import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './users.controller';
import { UsersModule } from './users.module';

/** HTTP surface for users. Separate from UsersModule because AuthModule already imports it. */
@Module({
  imports: [AuthModule, UsersModule],
  controllers: [UsersController],
})
export class UsersApiModule {}
