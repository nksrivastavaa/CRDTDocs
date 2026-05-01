import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from '../config/env';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool!: Pool;

  onModuleInit(): void {
    this.pool = new Pool({
      host: env('DB_HOST'),
      port: Number(env('DB_PORT', '5432')),
      database: env('DB_NAME'),
      user: env('DB_USER'),
      password: env('DB_PASSWORD'),
      max: Number(env('DB_POOL_SIZE', '10')),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  async one<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] ?? null;
  }

  async transaction<T>(handler: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      const result = await handler(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
