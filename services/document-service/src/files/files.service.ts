import { Injectable } from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomBytes } from 'crypto';
import { DatabaseService, env, envBool, optionalEnv } from '@collab/common';
import type { FileAttachment, UserSummary } from '@collab/types';
import { PermissionsService } from '../permissions/permissions.service';
import { CompleteUploadDto, CreateUploadDto } from './files.dto';

interface FileRow {
  id: string;
  document_id: string;
  uploader_id: string;
  filename: string;
  content_type: string;
  size_bytes: string | number;
  storage_key: string;
  public_url: string;
  created_at: string | Date;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

function mapUploader(row: FileRow): UserSummary {
  return {
    id: row.uploader_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function mapFile(row: FileRow): FileAttachment {
  return {
    id: row.id,
    documentId: row.document_id,
    uploader: mapUploader(row),
    filename: row.filename,
    contentType: row.content_type,
    sizeBytes: Number(row.size_bytes),
    storageKey: row.storage_key,
    publicUrl: row.public_url,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

@Injectable()
export class FilesService {
  private readonly s3 = new S3Client({
    region: env('AWS_REGION', 'us-east-1'),
    endpoint: optionalEnv('AWS_S3_ENDPOINT'),
    forcePathStyle: envBool('AWS_S3_FORCE_PATH_STYLE', false),
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
    },
  });

  private readonly bucket = env('AWS_S3_BUCKET', 'collab-uploads');

  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async createUpload(userId: string, documentId: string, dto: CreateUploadDto): Promise<{
    uploadUrl: string;
    storageKey: string;
    publicUrl: string;
  }> {
    await this.permissions.assertDocumentRole(userId, documentId, 'editor');
    const safeName = dto.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
    const storageKey = `documents/${documentId}/${Date.now()}-${randomBytes(8).toString('hex')}-${safeName}`;

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
        ContentType: dto.contentType,
      }),
      { expiresIn: 60 * 10 },
    );

    const publicBaseUrl = optionalEnv('AWS_S3_PUBLIC_URL', optionalEnv('AWS_S3_ENDPOINT', ''));
    const publicUrl = publicBaseUrl ? `${publicBaseUrl.replace(/\/$/, '')}/${this.bucket}/${storageKey}` : storageKey;

    return { uploadUrl, storageKey, publicUrl };
  }

  async completeUpload(userId: string, documentId: string, dto: CompleteUploadDto): Promise<FileAttachment> {
    await this.permissions.assertDocumentRole(userId, documentId, 'editor');
    const row = await this.db.one<FileRow>(
      `
        WITH inserted AS (
          INSERT INTO files (document_id, uploader_id, filename, content_type, size_bytes, storage_key, public_url)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        )
        SELECT
          f.id,
          f.document_id,
          f.uploader_id,
          f.filename,
          f.content_type,
          f.size_bytes,
          f.storage_key,
          f.public_url,
          f.created_at,
          u.email,
          u.display_name,
          u.avatar_url
        FROM inserted f
        INNER JOIN users u ON u.id = f.uploader_id
      `,
      [documentId, userId, dto.filename, dto.contentType, dto.sizeBytes, dto.storageKey, dto.publicUrl],
    );

    if (!row) {
      throw new Error('File insert did not return a row');
    }

    return mapFile(row);
  }

  async list(userId: string, documentId: string): Promise<FileAttachment[]> {
    await this.permissions.assertDocumentRole(userId, documentId, 'viewer');
    const result = await this.db.query<FileRow>(
      `
        SELECT
          f.id,
          f.document_id,
          f.uploader_id,
          f.filename,
          f.content_type,
          f.size_bytes,
          f.storage_key,
          f.public_url,
          f.created_at,
          u.email,
          u.display_name,
          u.avatar_url
        FROM files f
        INNER JOIN users u ON u.id = f.uploader_id
        WHERE f.document_id = $1
        ORDER BY f.created_at DESC
      `,
      [documentId],
    );

    return result.rows.map(mapFile);
  }
}
