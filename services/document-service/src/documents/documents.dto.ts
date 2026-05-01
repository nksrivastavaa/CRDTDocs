import { IsEmail, IsIn, IsObject, IsOptional, IsString, IsUUID, Length, ValidateIf } from 'class-validator';
import type { DocumentRole } from '@collab/types';

export class CreateDocumentDto {
  @IsString()
  @Length(1, 180)
  title!: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  @Length(1, 180)
  title?: string;

  @IsOptional()
  @IsObject()
  content?: Record<string, unknown>;
}

export class ShareDocumentDto {
  @ValidateIf((value: ShareDocumentDto) => !value.userId)
  @IsEmail()
  email?: string;

  @ValidateIf((value: ShareDocumentDto) => !value.email)
  @IsUUID()
  userId?: string;

  @IsIn(['owner', 'editor', 'viewer'])
  role!: DocumentRole;
}
