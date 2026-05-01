import type {
  AuthResponse,
  CommentItem,
  DocumentDetail,
  DocumentPermission,
  DocumentRole,
  DocumentSummary,
  FileAttachment,
  NotificationItem,
  UserSummary,
  WorkspaceSummary,
} from '@collab/types';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(body?.message ?? 'Request failed', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  login(email: string, password: string) {
    return request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  register(email: string, displayName: string, password: string) {
    return request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, displayName, password }),
    });
  },
  me(token: string) {
    return request<UserSummary>('/users/me', {}, token);
  },
  listWorkspaces(token: string) {
    return request<WorkspaceSummary[]>('/workspaces', {}, token);
  },
  createWorkspace(token: string, name: string) {
    return request<WorkspaceSummary>('/workspaces', { method: 'POST', body: JSON.stringify({ name }) }, token);
  },
  joinWorkspace(token: string, inviteCode: string) {
    return request<WorkspaceSummary>('/workspaces/join', { method: 'POST', body: JSON.stringify({ inviteCode }) }, token);
  },
  getWorkspace(token: string, workspaceId: string) {
    return request<WorkspaceSummary>(`/workspaces/${workspaceId}`, {}, token);
  },
  createInvite(token: string, workspaceId: string) {
    return request<{ inviteCode: string }>(`/workspaces/${workspaceId}/invites`, { method: 'POST' }, token);
  },
  listDocuments(token: string, workspaceId: string) {
    return request<DocumentSummary[]>(`/workspaces/${workspaceId}/documents`, {}, token);
  },
  createDocument(token: string, workspaceId: string, title: string) {
    return request<DocumentDetail>(
      `/workspaces/${workspaceId}/documents`,
      { method: 'POST', body: JSON.stringify({ title }) },
      token,
    );
  },
  getDocument(token: string, documentId: string) {
    return request<DocumentDetail>(`/documents/${documentId}`, {}, token);
  },
  updateDocument(token: string, documentId: string, payload: Partial<Pick<DocumentDetail, 'title' | 'content'>>) {
    return request<DocumentDetail>(
      `/documents/${documentId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      token,
    );
  },
  deleteDocument(token: string, documentId: string) {
    return request<{ deleted: true }>(`/documents/${documentId}`, { method: 'DELETE' }, token);
  },
  shareDocument(token: string, documentId: string, payload: { email?: string; userId?: string; role: DocumentRole }) {
    return request<DocumentPermission>(
      `/documents/${documentId}/share`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },
  listPermissions(token: string, documentId: string) {
    return request<DocumentPermission[]>(`/documents/${documentId}/permissions`, {}, token);
  },
  listComments(token: string, documentId: string) {
    return request<CommentItem[]>(`/documents/${documentId}/comments`, {}, token);
  },
  createComment(
    token: string,
    documentId: string,
    payload: { body: string; rangeFrom: number; rangeTo: number; selectedText?: string },
  ) {
    return request<CommentItem>(
      `/documents/${documentId}/comments`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },
  replyComment(token: string, commentId: string, body: string) {
    return request<CommentItem>(`/comments/${commentId}/replies`, { method: 'POST', body: JSON.stringify({ body }) }, token);
  },
  resolveComment(token: string, commentId: string) {
    return request<CommentItem>(`/comments/${commentId}/resolve`, { method: 'PATCH' }, token);
  },
  listNotifications(token: string) {
    return request<NotificationItem[]>('/notifications', {}, token);
  },
  markNotificationRead(token: string, notificationId: string) {
    return request<NotificationItem>(`/notifications/${notificationId}/read`, { method: 'PATCH' }, token);
  },
  markAllNotificationsRead(token: string) {
    return request<{ updated: number }>('/notifications/read-all', { method: 'PATCH' }, token);
  },
  listFiles(token: string, documentId: string) {
    return request<FileAttachment[]>(`/documents/${documentId}/files`, {}, token);
  },
  createUpload(token: string, documentId: string, file: File) {
    return request<{ uploadUrl: string; storageKey: string; publicUrl: string }>(
      `/documents/${documentId}/files/presign`,
      {
        method: 'POST',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
        }),
      },
      token,
    );
  },
  completeUpload(
    token: string,
    documentId: string,
    payload: { filename: string; contentType: string; sizeBytes: number; storageKey: string; publicUrl: string },
  ) {
    return request<FileAttachment>(
      `/documents/${documentId}/files/complete`,
      { method: 'POST', body: JSON.stringify(payload) },
      token,
    );
  },
};
