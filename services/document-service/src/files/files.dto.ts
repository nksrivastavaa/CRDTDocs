import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @Length(1, 240)
  filename!: string;

  @IsString()
  @Length(1, 120)
  contentType!: string;

  @IsInt()
  @Min(1)
  sizeBytes!: number;
}

export class CompleteUploadDto extends CreateUploadDto {
  @IsString()
  @Length(1, 1024)
  storageKey!: string;

  @IsString()
  @Length(1, 2048)
  publicUrl!: string;
}
