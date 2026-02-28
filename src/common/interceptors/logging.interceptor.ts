import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyReply, FastifyRequest } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          const res = context.switchToHttp().getResponse<FastifyReply>();
          const status = res.statusCode;
          const msg = `${method} ${url} ${status} ${ms}ms`;

          if (status >= 500) {
            this.logger.error(msg);
          } else if (status >= 400) {
            this.logger.warn(msg);
          } else {
            this.logger.log(msg);
          }
        },
        error: (err: unknown) => {
          const ms = Date.now() - start;
          const status = err instanceof HttpException ? err.getStatus() : 500;
          this.logger.error(`${method} ${url} ${status} ${ms}ms`);
        },
      }),
    );
  }
}
