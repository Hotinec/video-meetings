import { IsNotEmpty, IsString } from 'class-validator';

/** New-password rules match signup (`AuthDto`): a non-empty string. */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
