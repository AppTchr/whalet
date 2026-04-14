import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { SESSION_BEARER_PREFIX } from '../auth.constants';

export interface AuthenticatedRequest extends Request {
  userId: string;
}

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith(SESSION_BEARER_PREFIX)) {
      throw new UnauthorizedException('Missing or invalid authorization header.');
    }

    const rawToken = authHeader.slice(SESSION_BEARER_PREFIX.length).trim();

    if (!rawToken) {
      throw new UnauthorizedException('Missing session token.');
    }

    const result = await this.authService.validateSession(rawToken);

    if (!result) {
      throw new UnauthorizedException('Invalid or expired session.');
    }

    request.userId = result.userId;
    return true;
  }
}
