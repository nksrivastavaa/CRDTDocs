import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DatabaseService, RedisService } from '@collab/common';
import type { NotificationItem, NotificationType, UserSummary } from '@collab/types';

interface NotificationEvent {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_display_name: string | null;
  actor_avatar_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  read_at: string | Date | null;
  created_at: string | Date;
}

function mapNotification(row: NotificationRow): NotificationItem {
  const actor: UserSummary | null = row.actor_id
    ? {
        id: row.actor_id,
        email: row.actor_email ?? '',
        displayName: row.actor_display_name ?? 'Unknown user',
        avatarUrl: row.actor_avatar_url,
      }
    : null;

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    actor,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    readAt: row.read_at ? new Date(row.read_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly redis: RedisService,
  ) {}

  async onModuleInit(): Promise<void> {
    const subscriber = this.redis.getSubscriber();
    await subscriber.subscribe('notifications:events');
    subscriber.on('message', (_channel, message) => {
      void this.handleEvent(message);
    });
  }

  async list(userId: string): Promise<NotificationItem[]> {
    const result = await this.db.query<NotificationRow>(
      `
        SELECT
          n.id,
          n.type,
          n.title,
          n.body,
          n.actor_id,
          actor.email AS actor_email,
          actor.display_name AS actor_display_name,
          actor.avatar_url AS actor_avatar_url,
          n.entity_type,
          n.entity_id,
          n.metadata,
          n.read_at,
          n.created_at
        FROM notifications n
        LEFT JOIN users actor ON actor.id = n.actor_id
        WHERE n.user_id = $1
        ORDER BY n.created_at DESC
        LIMIT 50
      `,
      [userId],
    );

    return result.rows.map(mapNotification);
  }

  async markRead(userId: string, notificationId: string): Promise<NotificationItem> {
    const row = await this.db.one<NotificationRow>(
      `
        WITH updated AS (
          UPDATE notifications
          SET read_at = COALESCE(read_at, now())
          WHERE id = $1 AND user_id = $2
          RETURNING *
        )
        SELECT
          n.id,
          n.type,
          n.title,
          n.body,
          n.actor_id,
          actor.email AS actor_email,
          actor.display_name AS actor_display_name,
          actor.avatar_url AS actor_avatar_url,
          n.entity_type,
          n.entity_id,
          n.metadata,
          n.read_at,
          n.created_at
        FROM updated n
        LEFT JOIN users actor ON actor.id = n.actor_id
      `,
      [notificationId, userId],
    );

    if (!row) {
      throw new NotFoundException('Notification not found');
    }

    return mapNotification(row);
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.db.query(
      `
        UPDATE notifications
        SET read_at = COALESCE(read_at, now())
        WHERE user_id = $1 AND read_at IS NULL
      `,
      [userId],
    );

    return { updated: result.rowCount ?? 0 };
  }

  private async handleEvent(message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as NotificationEvent;

      await this.db.query(
        `
          INSERT INTO notifications (user_id, actor_id, type, title, body, entity_type, entity_id, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [
          event.userId,
          event.actorId ?? null,
          event.type,
          event.title,
          event.body,
          event.entityType ?? null,
          event.entityId ?? null,
          event.metadata ?? {},
        ],
      );
    } catch (error) {
      this.logger.warn(`Unable to persist notification event: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
