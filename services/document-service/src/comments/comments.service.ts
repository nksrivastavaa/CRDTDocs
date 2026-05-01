import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@collab/common';
import type { CommentItem, UserSummary } from '@collab/types';
import { NotificationPublisher } from '../notifications/notification.publisher';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateCommentDto, ReplyCommentDto } from './comments.dto';

interface CommentRow {
  id: string;
  document_id: string;
  parent_id: string | null;
  user_id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  body: string;
  range_from: number;
  range_to: number;
  selected_text: string | null;
  resolved_at: string | Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

interface NotifyTargetRow {
  user_id: string;
}

interface DocumentTitleRow {
  title: string;
}

function mapUser(row: CommentRow): UserSummary {
  return {
    id: row.user_id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

function mapComment(row: CommentRow): CommentItem {
  return {
    id: row.id,
    documentId: row.document_id,
    parentId: row.parent_id,
    user: mapUser(row),
    body: row.body,
    rangeFrom: row.range_from,
    rangeTo: row.range_to,
    selectedText: row.selected_text,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class CommentsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
    private readonly notifications: NotificationPublisher,
  ) {}

  async list(userId: string, documentId: string): Promise<CommentItem[]> {
    await this.permissions.assertDocumentRole(userId, documentId, 'viewer');
    const result = await this.db.query<CommentRow>(
      `
        SELECT
          c.id,
          c.document_id,
          c.parent_id,
          c.user_id,
          u.email,
          u.display_name,
          u.avatar_url,
          c.body,
          c.range_from,
          c.range_to,
          c.selected_text,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM comments c
        INNER JOIN users u ON u.id = c.user_id
        WHERE c.document_id = $1
        ORDER BY c.created_at ASC
      `,
      [documentId],
    );

    return result.rows.map(mapComment);
  }

  async create(userId: string, documentId: string, dto: CreateCommentDto): Promise<CommentItem> {
    await this.permissions.assertDocumentRole(userId, documentId, 'editor');

    const row = await this.db.one<CommentRow>(
      `
        WITH inserted AS (
          INSERT INTO comments (document_id, user_id, body, range_from, range_to, selected_text)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        )
        SELECT
          c.id,
          c.document_id,
          c.parent_id,
          c.user_id,
          u.email,
          u.display_name,
          u.avatar_url,
          c.body,
          c.range_from,
          c.range_to,
          c.selected_text,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM inserted c
        INNER JOIN users u ON u.id = c.user_id
      `,
      [documentId, userId, dto.body, dto.rangeFrom, dto.rangeTo, dto.selectedText ?? null],
    );

    if (!row) {
      throw new Error('Comment insert did not return a row');
    }

    await this.notifyParticipants(userId, documentId, row.id);
    return mapComment(row);
  }

  async reply(userId: string, commentId: string, dto: ReplyCommentDto): Promise<CommentItem> {
    const parent = await this.db.one<{ document_id: string; range_from: number; range_to: number; selected_text: string | null }>(
      `
        SELECT document_id, range_from, range_to, selected_text
        FROM comments
        WHERE id = $1
      `,
      [commentId],
    );

    if (!parent) {
      throw new NotFoundException('Comment not found');
    }

    await this.permissions.assertDocumentRole(userId, parent.document_id, 'editor');

    const row = await this.db.one<CommentRow>(
      `
        WITH inserted AS (
          INSERT INTO comments (document_id, parent_id, user_id, body, range_from, range_to, selected_text)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        )
        SELECT
          c.id,
          c.document_id,
          c.parent_id,
          c.user_id,
          u.email,
          u.display_name,
          u.avatar_url,
          c.body,
          c.range_from,
          c.range_to,
          c.selected_text,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM inserted c
        INNER JOIN users u ON u.id = c.user_id
      `,
      [parent.document_id, commentId, userId, dto.body, parent.range_from, parent.range_to, parent.selected_text],
    );

    if (!row) {
      throw new Error('Reply insert did not return a row');
    }

    await this.notifyParticipants(userId, parent.document_id, row.id);
    return mapComment(row);
  }

  async resolve(userId: string, commentId: string): Promise<CommentItem> {
    const existing = await this.db.one<{ document_id: string }>('SELECT document_id FROM comments WHERE id = $1', [commentId]);

    if (!existing) {
      throw new NotFoundException('Comment not found');
    }

    await this.permissions.assertDocumentRole(userId, existing.document_id, 'editor');

    const row = await this.db.one<CommentRow>(
      `
        WITH updated AS (
          UPDATE comments
          SET resolved_at = COALESCE(resolved_at, now())
          WHERE id = $1
          RETURNING *
        )
        SELECT
          c.id,
          c.document_id,
          c.parent_id,
          c.user_id,
          u.email,
          u.display_name,
          u.avatar_url,
          c.body,
          c.range_from,
          c.range_to,
          c.selected_text,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM updated c
        INNER JOIN users u ON u.id = c.user_id
      `,
      [commentId],
    );

    if (!row) {
      throw new NotFoundException('Comment not found');
    }

    return mapComment(row);
  }

  private async notifyParticipants(actorId: string, documentId: string, commentId: string): Promise<void> {
    const titleRow = await this.db.one<DocumentTitleRow>('SELECT title FROM documents WHERE id = $1', [documentId]);
    const targets = await this.db.query<NotifyTargetRow>(
      `
        SELECT DISTINCT user_id
        FROM (
          SELECT owner_id AS user_id FROM documents WHERE id = $1
          UNION
          SELECT user_id FROM document_permissions WHERE document_id = $1
        ) target_users
        WHERE user_id <> $2
      `,
      [documentId, actorId],
    );

    await Promise.all(
      targets.rows.map((target) =>
        this.notifications.publish({
          userId: target.user_id,
          actorId,
          type: 'comment_added',
          title: 'New comment',
          body: `A comment was added to ${titleRow?.title ?? 'a document'}.`,
          entityType: 'document',
          entityId: documentId,
          metadata: { commentId },
        }),
      ),
    );
  }
}
