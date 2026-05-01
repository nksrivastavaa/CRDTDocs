import { IsEmail, IsString, Length } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(2, 80)
  displayName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
