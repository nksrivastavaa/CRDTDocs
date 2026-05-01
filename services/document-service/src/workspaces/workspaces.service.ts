import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { DatabaseService } from '@collab/common';
import type { WorkspaceSummary } from '@collab/types';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateWorkspaceDto, JoinWorkspaceDto } from './workspaces.dto';

interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  invite_code: string;
  role: 'owner' | 'admin' | 'member';
  created_at: string | Date;
  updated_at: string | Date;
}

function mapWorkspace(row: WorkspaceRow): WorkspaceSummary {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.invite_code,
    role: row.role,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly permissions: PermissionsService,
  ) {}

  async create(userId: string, dto: CreateWorkspaceDto): Promise<WorkspaceSummary> {
    return this.db.transaction(async (client) => {
      const workspaceResult = await client.query<WorkspaceRow>(
        `
          INSERT INTO workspaces (name, owner_id, invite_code)
          VALUES ($1, $2, $3)
          RETURNING id, name, owner_id, invite_code, 'owner'::workspace_role AS role, created_at, updated_at
        `,
        [dto.name, userId, randomBytes(12).toString('hex')],
      );

      const workspace = workspaceResult.rows[0];
      await client.query(
        `
          INSERT INTO workspace_members (workspace_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
        [workspace.id, userId],
      );

      return mapWorkspace(workspace);
    });
  }

  async list(userId: string): Promise<WorkspaceSummary[]> {
    const result = await this.db.query<WorkspaceRow>(
      `
        SELECT w.id, w.name, w.owner_id, w.invite_code, wm.role, w.created_at, w.updated_at
        FROM workspaces w
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = $1
        ORDER BY w.updated_at DESC
      `,
      [userId],
    );

    return result.rows.map(mapWorkspace);
  }

  async get(userId: string, workspaceId: string): Promise<WorkspaceSummary> {
    await this.permissions.assertWorkspaceMember(userId, workspaceId);

    const row = await this.db.one<WorkspaceRow>(
      `
        SELECT w.id, w.name, w.owner_id, w.invite_code, wm.role, w.created_at, w.updated_at
        FROM workspaces w
        INNER JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = $2
        WHERE w.id = $1
      `,
      [workspaceId, userId],
    );

    if (!row) {
      throw new NotFoundException('Workspace not found');
    }

    return mapWorkspace(row);
  }

  async createInvite(userId: string, workspaceId: string): Promise<{ inviteCode: string }> {
    await this.permissions.assertWorkspaceAdmin(userId, workspaceId);
    const inviteCode = randomBytes(12).toString('hex');

    const row = await this.db.one<{ invite_code: string }>(
      `
        UPDATE workspaces
        SET invite_code = $2
        WHERE id = $1
        RETURNING invite_code
      `,
      [workspaceId, inviteCode],
    );

    if (!row) {
      throw new NotFoundException('Workspace not found');
    }

    return { inviteCode: row.invite_code };
  }

  async join(userId: string, dto: JoinWorkspaceDto): Promise<WorkspaceSummary> {
    const row = await this.db.one<WorkspaceRow>(
      `
        WITH target_workspace AS (
          SELECT id, name, owner_id, invite_code, created_at, updated_at
          FROM workspaces
          WHERE invite_code = $1
        ),
        membership AS (
          INSERT INTO workspace_members (workspace_id, user_id, role)
          SELECT id, $2, 'member'
          FROM target_workspace
          ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = workspace_members.role
          RETURNING workspace_id, role
        )
        SELECT tw.id, tw.name, tw.owner_id, tw.invite_code, m.role, tw.created_at, tw.updated_at
        FROM target_workspace tw
        INNER JOIN membership m ON m.workspace_id = tw.id
      `,
      [dto.inviteCode, userId],
    );

    if (!row) {
      throw new NotFoundException('Invite not found');
    }

    return mapWorkspace(row);
  }
}
