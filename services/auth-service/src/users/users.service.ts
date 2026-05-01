import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@collab/common';
import type { UserSummary } from '@collab/types';
import { UpdateProfileDto } from './users.dto';

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
}

function toUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async create(email: string, displayName: string, passwordHash: string): Promise<UserSummary> {
    try {
      const row = await this.db.one<UserRow>(
        `
          INSERT INTO users (email, display_name, password_hash)
          VALUES (lower($1), $2, $3)
          RETURNING id, email, password_hash, display_name, avatar_url
        `,
        [email, displayName, passwordHash],
      );

      if (!row) {
        throw new Error('User insert did not return a row');
      }

      return toUserSummary(row);
    } catch (error) {
      const dbError = error as { code?: string };

      if (dbError.code === '23505') {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }
  }

  async findByEmailWithPassword(email: string): Promise<UserRow | null> {
    return this.db.one<UserRow>(
      `
        SELECT id, email, password_hash, display_name, avatar_url
        FROM users
        WHERE email = lower($1)
      `,
      [email],
    );
  }

  async findById(id: string): Promise<UserSummary | null> {
    const row = await this.db.one<UserRow>(
      `
        SELECT id, email, password_hash, display_name, avatar_url
        FROM users
        WHERE id = $1
      `,
      [id],
    );

    return row ? toUserSummary(row) : null;
  }

  async getProfile(id: string): Promise<UserSummary> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<UserSummary> {
    const row = await this.db.one<UserRow>(
      `
        UPDATE users
        SET
          display_name = COALESCE($2, display_name),
          avatar_url = COALESCE($3, avatar_url)
        WHERE id = $1
        RETURNING id, email, password_hash, display_name, avatar_url
      `,
      [id, dto.displayName, dto.avatarUrl],
    );

    if (!row) {
      throw new NotFoundException('User not found');
    }

    return toUserSummary(row);
  }
}
