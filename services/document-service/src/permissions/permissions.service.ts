import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService, hasDocumentRole, maxDocumentRole } from '@collab/common';
import type { DocumentRole, WorkspaceRole } from '@collab/types';

interface WorkspaceMemberRow {
  role: WorkspaceRole;
}

interface WorkspaceAccessRow {
  has_access: boolean;
}

interface DocumentAccessRow {
  owner_id: string;
  workspace_role: WorkspaceRole | null;
  direct_role: DocumentRole | null;
}

@Injectable()
export class PermissionsService {
  constructor(private readonly db: DatabaseService) {}

  async getWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
    const row = await this.db.one<WorkspaceMemberRow>(
      `
        SELECT role
        FROM workspace_members
        WHERE workspace_id = $1 AND user_id = $2
      `,
      [workspaceId, userId],
    );

    return row?.role ?? null;
  }

  async assertWorkspaceMember(userId: string, workspaceId: string): Promise<WorkspaceRole> {
    const role = await this.getWorkspaceRole(userId, workspaceId);

    if (!role) {
      throw new ForbiddenException('You are not a member of this workspace');
    }

    return role;
  }

  async hasWorkspaceAccess(userId: string, workspaceId: string): Promise<boolean> {
    const row = await this.db.one<WorkspaceAccessRow>(
      `
        SELECT EXISTS (
          SELECT 1
          FROM workspaces w
          WHERE w.id = $1
            AND (
              EXISTS (
                SELECT 1
                FROM workspace_members wm
                WHERE wm.workspace_id = w.id
                  AND wm.user_id = $2
              )
              OR EXISTS (
                SELECT 1
                FROM documents d
                INNER JOIN document_permissions dp ON dp.document_id = d.id
                WHERE d.workspace_id = w.id
                  AND d.is_deleted = false
                  AND dp.user_id = $2
              )
            )
        ) AS has_access
      `,
      [workspaceId, userId],
    );

    return Boolean(row?.has_access);
  }

  async assertWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
    if (!(await this.hasWorkspaceAccess(userId, workspaceId))) {
      throw new ForbiddenException('You do not have access to this workspace');
    }
  }

  async assertWorkspaceAdmin(userId: string, workspaceId: string): Promise<WorkspaceRole> {
    const role = await this.assertWorkspaceMember(userId, workspaceId);

    if (!['owner', 'admin'].includes(role)) {
      throw new ForbiddenException('Workspace admin access required');
    }

    return role;
  }

  async getDocumentRole(userId: string, documentId: string): Promise<DocumentRole | null> {
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

  async assertDocumentRole(userId: string, documentId: string, requiredRole: DocumentRole): Promise<DocumentRole> {
    const role = await this.getDocumentRole(userId, documentId);

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
