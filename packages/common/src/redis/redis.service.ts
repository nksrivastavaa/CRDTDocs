import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { env } from '../config/env';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client!: Redis;
  private publisher!: Redis;
  private subscriber!: Redis;

  onModuleInit(): void {
    const url = env('REDIS_URL', 'redis://localhost:6379');
    this.client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.publisher = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    this.subscriber = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
  }

  getClient(): Redis {
    return this.client;
  }

  getPublisher(): Redis {
    return this.publisher;
  }

  getSubscriber(): Redis {
    return this.subscriber;
  }

  publishJson(channel: string, payload: unknown): Promise<number> {
    return this.publisher.publish(channel, JSON.stringify(payload));
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([this.client?.quit(), this.publisher?.quit(), this.subscriber?.quit()]);
  }
}
