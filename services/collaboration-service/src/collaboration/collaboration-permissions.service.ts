import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, hasDocumentRole, maxDocumentRole } from '@collab/common';
import type { DocumentRole, WorkspaceRole } from '@collab/types';

interface DocumentAccessRow {
  owner_id: string;
  workspace_role: WorkspaceRole | null;
  direct_role: DocumentRole | null;
}

@Injectable()
export class CollaborationPermissionsService {
  constructor(private readonly db: DatabaseService) {}

  async getRole(userId: string, documentId: string): Promise<DocumentRole | null> {
    const row = await this.db.one<DocumentAccessRow>(
      `
        SELECT
          d.owner_id,
          wm.role AS workspace_role,
          dp.role AS direct_role
        FROM documents d
        LEFT JOIN workspace_members wm
          ON wm.workspace_id = d.workspace_id
          AND wm.user_id = $2
        LEFT JOIN document_permissions dp
          ON dp.document_id = d.id
          AND dp.user_id = $2
        WHERE d.id = $1
          AND d.is_deleted = false
      `,
      [documentId, userId],
    );

    if (!row) {
      throw new NotFoundException('Document not found');
    }

    const workspaceRole = this.workspaceRoleToDocumentRole(row.workspace_role);
    const ownerRole: DocumentRole | null = row.owner_id === userId ? 'owner' : null;
    return maxDocumentRole([ownerRole, row.direct_role, workspaceRole]);
  }

  async assertRole(userId: string, documentId: string, requiredRole: DocumentRole): Promise<DocumentRole> {
    const role = await this.getRole(userId, documentId);

    if (!hasDocumentRole(role, requiredRole)) {
      throw new ForbiddenException(`${requiredRole} access required`);
    }

    return role as DocumentRole;
  }

  private workspaceRoleToDocumentRole(role: WorkspaceRole | null): DocumentRole | null {
    if (!role) {
      return null;
    }

    if (role === 'owner') {
      return 'owner';
    }

    if (role === 'admin') {
      return 'editor';
    }

    return 'viewer';
  }
}
