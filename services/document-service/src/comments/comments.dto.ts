import { IsInt, IsOptional, IsString, IsUUID, Length, Min } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 4000)
  body!: string;

  @IsInt()
  @Min(0)
  rangeFrom!: number;

  @IsInt()
  @Min(0)
  rangeTo!: number;

  @IsOptional()
  @IsString()
  selectedText?: string;
}

export class ReplyCommentDto {
  @IsString()
  @Length(1, 4000)
  body!: string;
}

export class ResolveCommentDto {
  @IsOptional()
  @IsUUID()
  commentId?: string;
}
