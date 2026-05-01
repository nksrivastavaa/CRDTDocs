import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 80)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
