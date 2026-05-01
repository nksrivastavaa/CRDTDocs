import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { DatabaseService, RedisService, env, hasDocumentRole } from '@collab/common';
import type { CollaboratorPresence, DocumentRole, JwtPayload } from '@collab/types';
import { CollaborationPermissionsService } from './collaboration-permissions.service';
import { DocumentSessionService } from './document-session.service';

interface JoinPayload {
  documentId: string;
}

interface UpdatePayload {
  documentId: string;
  update: number[];
}

interface PresencePayload {
  documentId: string;
  update: number[];
}

interface PresenceUserRow {
  id: string;
  email: string;
  display_name: string;
}

type ClientSocket = Socket & {
  data: {
    user?: JwtPayload;
    documents?: Map<string, DocumentRole>;
  };
};

const PRESENCE_COLORS = ['#1f7a5c', '#d1495b', '#edae49', '#3066be', '#6a4c93', '#2a9d8f', '#e76f51', '#264653'];

@WebSocketGateway({
  namespace: '/collaboration',
  cors: { origin: '*', credentials: true },
})
export class CollaborationGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private server!: Server;

  private readonly logger = new Logger(CollaborationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly redis: RedisService,
    private readonly db: DatabaseService,
    private readonly permissions: CollaborationPermissionsService,
    private readonly sessions: DocumentSessionService,
  ) {}

  afterInit(server: Server): void {
    this.server.adapter(createAdapter(this.redis.getPublisher(), this.redis.getSubscriber()));
    this.logger.log('Socket.IO Redis adapter initialized');
  }

  handleConnection(socket: ClientSocket): void {
    const token = this.extractToken(socket);

    if (!token) {
      socket.emit('collaboration:error', { message: 'Missing auth token' });
      socket.disconnect(true);
      return;
    }

    try {
      socket.data.user = this.jwtService.verify<JwtPayload>(token, {
        secret: env('JWT_SECRET', 'development-secret'),
      });
      socket.data.documents = new Map();
    } catch {
      socket.emit('collaboration:error', { message: 'Invalid auth token' });
      socket.disconnect(true);
    }
  }

  async handleDisconnect(socket: ClientSocket): Promise<void> {
    const user = socket.data.user;
    const documents = socket.data.documents;

    if (!user || !documents) {
      return;
    }

    await Promise.all(
      [...documents.keys()].map(async (documentId) => {
        await this.redis.getClient().srem(this.presenceKey(documentId), user.sub);
        socket.to(this.room(documentId)).emit('presence:users', await this.getPresence(documentId));
      }),
    );
  }

  @SubscribeMessage('document:join')
  async joinDocument(@ConnectedSocket() socket: ClientSocket, @MessageBody() payload: JoinPayload): Promise<void> {
    const user = this.requireUser(socket);
    const role = await this.permissions.assertRole(user.sub, payload.documentId, 'viewer');
    const room = this.room(payload.documentId);
    const encodedState = await this.sessions.encodeState(payload.documentId);

    await socket.join(room);
    socket.data.documents?.set(payload.documentId, role);
    await this.redis.getClient().sadd(this.presenceKey(payload.documentId), user.sub);
    await this.redis.getClient().expire(this.presenceKey(payload.documentId), 60 * 60);

    socket.emit('document:sync', {
      documentId: payload.documentId,
      update: Array.from(encodedState),
      role,
    });
    this.server.to(room).emit('presence:users', await this.getPresence(payload.documentId));
  }

  @SubscribeMessage('document:update')
  async handleDocumentUpdate(@ConnectedSocket() socket: ClientSocket, @MessageBody() payload: UpdatePayload): Promise<void> {
    const user = this.requireUser(socket);
    const role = socket.data.documents?.get(payload.documentId) ?? (await this.permissions.getRole(user.sub, payload.documentId));

    if (!hasDocumentRole(role, 'editor')) {
      socket.emit('collaboration:error', { message: 'Editor access required' });
      return;
    }

    const update = new Uint8Array(payload.update);
    await this.sessions.applyUpdate(payload.documentId, update);
    socket.to(this.room(payload.documentId)).emit('document:update', {
      documentId: payload.documentId,
      update: payload.update,
    });
  }

  @SubscribeMessage('presence:update')
  async handlePresenceUpdate(@ConnectedSocket() socket: ClientSocket, @MessageBody() payload: PresencePayload): Promise<void> {
    const user = this.requireUser(socket);
    await this.permissions.assertRole(user.sub, payload.documentId, 'viewer');
    socket.to(this.room(payload.documentId)).emit('presence:update', {
      documentId: payload.documentId,
      update: payload.update,
    });
  }

  private requireUser(socket: ClientSocket): JwtPayload {
    const user = socket.data.user;

    if (!user) {
      socket.disconnect(true);
      throw new Error('Socket is not authenticated');
    }

    return user;
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token;

    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const header = socket.handshake.headers.authorization;

    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }

  private async getPresence(documentId: string): Promise<CollaboratorPresence[]> {
    const userIds = await this.redis.getClient().smembers(this.presenceKey(documentId));

    if (userIds.length === 0) {
      return [];
    }

    const result = await this.db.query<PresenceUserRow>(
      `
        SELECT id, email, display_name
        FROM users
        WHERE id = ANY($1::uuid[])
      `,
      [userIds],
    );

    return result.rows.map((row) => ({
      userId: row.id,
      email: row.email,
      displayName: row.display_name,
      color: this.colorFor(row.id),
    }));
  }

  private colorFor(userId: string): string {
    const hash = [...userId].reduce((total, char) => total + char.charCodeAt(0), 0);
    return PRESENCE_COLORS[hash % PRESENCE_COLORS.length];
  }

  private room(documentId: string): string {
    return `document:${documentId}`;
  }

  private presenceKey(documentId: string): string {
    return `presence:${documentId}`;
  }
}
