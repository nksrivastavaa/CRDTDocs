import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtPayload } from '@collab/types';
import type { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): JwtPayload => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.user;
  },
);
