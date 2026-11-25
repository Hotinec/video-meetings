import { IsString, Matches } from 'class-validator';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from '../username';

export class UpdateUsernameDto {
  @IsString()
  @Matches(new RegExp(`^[A-Za-z0-9_-]{${USERNAME_MIN_LENGTH},${USERNAME_MAX_LENGTH}}$`), {
    message: `username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters: letters, digits, _ or -`,
  })
  username: string;
}
