import { useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import type { CollaboratorPresence, CommentRealtimeEvent, DocumentRole, UserSummary } from '@collab/types';

const WS_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'http://localhost:3003';
const COLORS = ['#1f7a5c', '#d1495b', '#edae49', '#3066be', '#6a4c93', '#2a9d8f', '#e76f51'];

interface CollaborationOptions {
  onCommentUpsert?: (event: CommentRealtimeEvent) => void;
}

function colorForUser(userId: string): string {
  const hash = [...userId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLORS[hash % COLORS.length];
}

export function useCollaboration(
  documentId: string | undefined,
  token: string | null,
  user: UserSummary | null,
  options: CollaborationOptions = {},
) {
  const ydoc = useMemo(() => new Y.Doc(), [documentId]);
  const awareness = useMemo(() => new Awareness(ydoc), [ydoc]);
  const provider = useMemo(() => ({ awareness }), [awareness]);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [synced, setSynced] = useState(false);
  const [role, setRole] = useState<DocumentRole | null>(null);
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const roleRef = useRef<DocumentRole | null>(null);
  const onCommentUpsertRef = useRef<CollaborationOptions['onCommentUpsert']>(options.onCommentUpsert);

  useEffect(() => {
    roleRef.current = role;
  }, [role]);

  useEffect(() => {
    onCommentUpsertRef.current = options.onCommentUpsert;
  }, [options.onCommentUpsert]);

  useEffect(() => {
    if (!documentId || !token || !user) {
      return;
    }

    const namespace = WS_URL ? `${WS_URL}/collaboration` : '/collaboration';
    const socket: Socket = io(namespace, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    const canSendDocumentUpdate = () => roleRef.current === 'owner' || roleRef.current === 'editor';

    const handleLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'remote' || !canSendDocumentUpdate()) {
        return;
      }

      socket.emit('document:update', {
        documentId,
        update: Array.from(update),
      });
    };

    const handleAwarenessUpdate = (
      changes: { added: number[]; updated: number[]; removed: number[] },
      origin: unknown,
    ) => {
      if (origin === 'remote') {
        return;
      }

      const changedClients = changes.added.concat(changes.updated, changes.removed);
      socket.emit('presence:update', {
        documentId,
        update: Array.from(encodeAwarenessUpdate(awareness, changedClients)),
      });
    };

    ydoc.on('update', handleLocalUpdate);
    awareness.on('update', handleAwarenessUpdate);

    socket.on('connect', () => {
      setStatus('connected');
      socket.emit('document:join', { documentId });
      awareness.setLocalStateField('user', {
        id: user.id,
        name: user.displayName,
        email: user.email,
        color: colorForUser(user.id),
      });
    });

    socket.on('disconnect', () => {
      setStatus('offline');
    });

    socket.on('document:sync', (payload: { documentId: string; update: number[]; role: DocumentRole }) => {
      if (payload.documentId !== documentId) {
        return;
      }

      Y.applyUpdate(ydoc, new Uint8Array(payload.update), 'remote');
      setRole(payload.role);
      setSynced(true);
    });

    socket.on('document:update', (payload: { documentId: string; update: number[] }) => {
      if (payload.documentId === documentId) {
        Y.applyUpdate(ydoc, new Uint8Array(payload.update), 'remote');
      }
    });

    socket.on('presence:update', (payload: { documentId: string; update: number[] }) => {
      if (payload.documentId === documentId) {
        applyAwarenessUpdate(awareness, new Uint8Array(payload.update), 'remote');
      }
    });

    socket.on('presence:users', (users: CollaboratorPresence[]) => {
      setCollaborators(users);
    });

    socket.on('comment:upsert', (event: CommentRealtimeEvent) => {
      if (event.documentId === documentId) {
        onCommentUpsertRef.current?.(event);
      }
    });

    socket.on('collaboration:error', (payload: { message: string }) => {
      console.warn(payload.message);
    });

    return () => {
      awareness.off('update', handleAwarenessUpdate);
      ydoc.off('update', handleLocalUpdate);
      socket.disconnect();
      awareness.destroy();
      ydoc.destroy();
      setSynced(false);
      setRole(null);
      setCollaborators([]);
    };
  }, [awareness, documentId, token, user, ydoc]);

  return { ydoc, awareness, provider, status, synced, role, collaborators };
}
