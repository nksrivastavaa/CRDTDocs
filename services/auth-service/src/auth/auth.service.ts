import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hashPassword, verifyPassword } from '@collab/common';
import type { AuthResponse, UserSummary } from '@collab/types';
import { UsersService } from '../users/users.service';
import { LoginDto, RegisterDto } from './auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await hashPassword(dto.password);
    const user = await this.usersService.create(dto.email, dto.displayName, passwordHash);
    return this.issueToken(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const userWithPassword = await this.usersService.findByEmailWithPassword(dto.email);

    if (!userWithPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const validPassword = await verifyPassword(dto.password, userWithPassword.password_hash);

    if (!validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueToken({
      id: userWithPassword.id,
      email: userWithPassword.email,
      displayName: userWithPassword.display_name,
      avatarUrl: userWithPassword.avatar_url,
    });
  }

  private issueToken(user: UserSummary): AuthResponse {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      displayName: user.displayName,
    });

    return { accessToken, user };
  }
}
