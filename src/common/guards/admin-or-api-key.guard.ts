import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminOrApiKeyGuard implements CanActivate {
  private readonly jwtGuard: CanActivate;

  constructor(private readonly configService: ConfigService) {
    this.jwtGuard = new (AuthGuard('jwt'))();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Try API key first
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    const validKey = this.configService.get<string>('POS_API_KEY');

    if (apiKey && apiKey === validKey) {
      return true;
    }

    // Fall back to JWT auth
    try {
      const result = await (this.jwtGuard as any).canActivate(context);
      if (!result) return false;

      const user = request.user;
      return user?.role === 'admin' || user?.role === 'super_admin';
    } catch {
      return false;
    }
  }
}
