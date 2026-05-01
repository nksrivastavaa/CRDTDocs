import { IsString, Length } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @Length(2, 120)
  name!: string;
}

export class JoinWorkspaceDto {
  @IsString()
  @Length(6, 80)
  inviteCode!: string;
}
