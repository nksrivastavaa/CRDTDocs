import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@collab/common';
import type { DocumentDetail, DocumentPermission, DocumentRole, DocumentSummary, UserSummary } from '@collab/types';
import { NotificationPublisher } from '../notifications/notification.publisher';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateDocumentDto, ShareDocumentDto, UpdateDocumentDto } from './documents.dto';

const EMPTY_DOCUMENT = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

interface DocumentRow {
  id: string;
  workspace_id: string;
  owner_id: string;
  title: string;
  content: Record<string, unknown>;
  role: DocumentRole;
  created_at: string | Date;
  updated_at: string | Date;
}

interface UserRow {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

interface PermissionRow {
  document_id: string;
  role: DocumentRole;
  created_at: string | Date;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
}

function mapUser(row: UserRow | PermissionRow): UserSummary {
  return {
    id: 'user_id' in row ? row.user_id : row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function mapDocumentSummary(row: DocumentRow): DocumentSummary {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    ownerId: row.owner_id,
    title: row.title,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function mapDocumentDetail(row: DocumentRow): DocumentDetail {
  return {
    ...mapDocumentSummary(row),
    content: row.content,
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async create(userId: string, workspaceId: string, dto: CreateDocumentDto): Promise<DocumentDetail> {
    await this.permissions.assertWorkspaceMember(userId, workspaceId);

    return this.db.transaction(async (client) => {
      const documentResult = await client.query<DocumentRow>(
        `
          INSERT INTO documents (workspace_id, owner_id, title, content)
          VALUES ($1, $2, $3, $4::jsonb)
          RETURNING id, workspace_id, owner_id, title, content, 'owner'::document_role AS role, created_at, updated_at
        `,
        [workspaceId, userId, dto.title, dto.content ?? EMPTY_DOCUMENT],
      );
      const document = documentResult.rows[0];

      await client.query(
        `
          INSERT INTO document_permissions (document_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
        [document.id, userId],
      );

      return mapDocumentDetail(document);
    });
  }

  async listByWorkspace(userId: string, workspaceId: string): Promise<DocumentSummary[]> {
    await this.permissions.assertWorkspaceAccess(userId, workspaceId);

    const result = await this.db.query<DocumentRow>(
      `
        SELECT
          d.id,
          d.workspace_id,
          d.owner_id,
          d.title,
          d.content,
          COALESCE(
            CASE
              WHEN d.owner_id = $2 OR wm.role = 'owner' OR dp.role = 'owner' THEN 'owner'::document_role
              WHEN wm.role = 'admin' OR dp.role = 'editor' THEN 'editor'::document_role
              WHEN wm.role IS NOT NULL OR dp.role = 'viewer' THEN 'viewer'::document_role
              ELSE NULL
            END,
            'viewer'::document_role
          ) AS role,
          d.created_at,
          d.updated_at
        FROM documents d
        LEFT JOIN workspace_members wm ON wm.workspace_id = d.workspace_id AND wm.user_id = $2
        LEFT JOIN document_permissions dp ON dp.document_id = d.id AND dp.user_id = $2
        WHERE d.workspace_id = $1
          AND d.is_deleted = false
          AND (wm.user_id IS NOT NULL OR dp.user_id IS NOT NULL OR d.owner_id = $2)
        ORDER BY d.updated_at DESC
      `,
      [workspaceId, userId],
    );

    return result.rows.map(mapDocumentSummary);
  }

  async get(userId: string, documentId: string): Promise<DocumentDetail> {
    const role = await this.permissions.assertDocumentRole(userId, documentId, 'viewer');
    const row = await this.db.one<DocumentRow>(
      `
        SELECT id, workspace_id, owner_id, title, content, $2::document_role AS role, created_at, updated_at
        FROM documents
        WHERE id = $1 AND is_deleted = false
      `,
      [documentId, role],
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    return mapDocumentDetail(row);
  }

  async update(userId: string, documentId: string, dto: UpdateDocumentDto): Promise<DocumentDetail> {
    await this.permissions.assertDocumentRole(userId, documentId, 'editor');

    if (dto.title === undefined && dto.content === undefined) {
      return this.get(userId, documentId);
    }

    const row = await this.db.one<DocumentRow>(
      `
        UPDATE documents
        SET
          title = COALESCE($2, title),
          content = COALESCE($3::jsonb, content)
        WHERE id = $1
          AND is_deleted = false
        RETURNING id, workspace_id, owner_id, title, content, 'editor'::document_role AS role, created_at, updated_at
      `,
      [documentId, dto.title, dto.content],
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    const role = await this.permissions.getDocumentRole(userId, documentId);
    return mapDocumentDetail({ ...row, role: role ?? 'viewer' });
  }

  async remove(userId: string, documentId: string): Promise<{ deleted: true }> {
    await this.permissions.assertDocumentRole(userId, documentId, 'owner');

    const row = await this.db.one<{ id: string }>(
      `
        UPDATE documents
        SET is_deleted = true
        WHERE id = $1 AND is_deleted = false
        RETURNING id
      `,
      [documentId],
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    return { deleted: true };
  }

  async share(userId: string, documentId: string, dto: ShareDocumentDto): Promise<DocumentPermission> {
    await this.permissions.assertDocumentRole(userId, documentId, 'owner');

    const target = await this.findShareTarget(dto);

    if (target.id === userId && dto.role !== 'owner') {
      throw new ForbiddenException('Document owner cannot demote themselves');
    }

    const row = await this.db.one<PermissionRow>(
      `
        INSERT INTO document_permissions (document_id, user_id, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (document_id, user_id)
        DO UPDATE SET role = excluded.role
        RETURNING document_id, role, created_at, user_id,
          (SELECT email FROM users WHERE id = $2) AS email,
          (SELECT display_name FROM users WHERE id = $2) AS display_name,
          (SELECT avatar_url FROM users WHERE id = $2) AS avatar_url
      `,
      [documentId, target.id, dto.role],
    );

    if (!row) {
      throw new Error('Permission insert did not return a row');
    }

    const document = await this.get(userId, documentId);
    await this.notifications.publish({
      userId: target.id,
      actorId: userId,
      type: 'document_shared',
      title: 'Document shared with you',
      body: `${document.title} was shared with you as ${dto.role}.`,
      entityType: 'document',
      entityId: documentId,
      metadata: { role: dto.role, documentTitle: document.title },
    });

    return {
      documentId: row.document_id,
      user: mapUser(row),
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
    };
  }

  async listPermissions(userId: string, documentId: string): Promise<DocumentPermission[]> {
    await this.permissions.assertDocumentRole(userId, documentId, 'owner');

    const result = await this.db.query<PermissionRow>(
      `
        SELECT
          dp.document_id,
          dp.role,
          dp.created_at,
          u.id AS user_id,
          u.email,
          u.display_name,
          u.avatar_url
        FROM document_permissions dp
        INNER JOIN users u ON u.id = dp.user_id
        WHERE dp.document_id = $1
        ORDER BY dp.created_at ASC
      `,
      [documentId],
    );

    return result.rows.map((row) => ({
      documentId: row.document_id,
      user: mapUser(row),
      role: row.role,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }

  private async findShareTarget(dto: ShareDocumentDto): Promise<UserRow> {
    const row = await this.db.one<UserRow>(
      `
        SELECT id, email, display_name, avatar_url
        FROM users
        WHERE ($1::uuid IS NOT NULL AND id = $1::uuid)
           OR ($2::text IS NOT NULL AND email = lower($2))
      `,
      [dto.userId ?? null, dto.email ?? null],
    );

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return row;
  }
}
