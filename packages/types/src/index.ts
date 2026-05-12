export type DocumentRole = 'owner' | 'editor' | 'viewer';
export type WorkspaceRole = 'owner' | 'admin' | 'member';
export type NotificationType = 'document_shared' | 'comment_added' | 'mention' | 'system';

export interface JwtPayload {
  sub: string;
  email: string;
  displayName: string;
}

export interface UserSummary {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserSummary;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
  accessType?: 'member' | 'shared';
  ownerId: string;
  inviteCode?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSummary {
  id: string;
  workspaceId: string;
  ownerId: string;
  title: string;
  role: DocumentRole;
  updatedAt: string;
  createdAt: string;
}

export interface DocumentDetail extends DocumentSummary {
  content: Record<string, unknown>;
}

export interface DocumentPermission {
  documentId: string;
  user: UserSummary;
  role: DocumentRole;
  createdAt: string;
}

export interface CommentItem {
  id: string;
  documentId: string;
  parentId?: string | null;
  user: UserSummary;
  resolvedBy?: UserSummary | null;
  body: string;
  rangeFrom: number;
  rangeTo: number;
  selectedText?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommentRealtimeEvent {
  type: 'created' | 'updated' | 'resolved';
  documentId: string;
  comment: CommentItem;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor?: UserSummary | null;
  entityType?: string | null;
  entityId?: string | null;
  readAt?: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface FileAttachment {
  id: string;
  documentId: string;
  uploader: UserSummary;
  filename: string;
  contentType: string;
  sizeBytes: number;
  storageKey: string;
  publicUrl: string;
  createdAt: string;
}

export interface CollaboratorPresence {
  userId: string;
  displayName: string;
  email: string;
  color: string;
}

export interface ApiErrorShape {
  statusCode: number;
  message: string;
  path?: string;
  timestamp: string;
}
