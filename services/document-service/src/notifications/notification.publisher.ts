import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@collab/common';
import type { NotificationType } from '@collab/types';

export interface NotificationEvent {
  userId: string;
  actorId?: string;
  type: NotificationType;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class NotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);

  constructor(private readonly redis: RedisService) {}

  async publish(event: NotificationEvent): Promise<void> {
    try {
      await this.redis.publishJson('notifications:events', event);
    } catch (error) {
      this.logger.warn(`Unable to publish notification event: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
  }
}
