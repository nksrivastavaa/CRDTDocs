import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtPayload } from '@collab/types';

function extractBearerToken(header?: string): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string>; user?: JwtPayload }>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Missing bearer token');
    }

    try {
      request.user = this.jwtService.verify<JwtPayload>(token, {
        secret: process.env.JWT_SECRET,
      });
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
