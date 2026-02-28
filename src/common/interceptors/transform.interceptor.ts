import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class TransformInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        // If response already has 'data' key, pass through (already wrapped)
        if (data && typeof data === 'object' && 'data' in data) {
          return data;
        }
        // Otherwise wrap in standard envelope
        return { data };
      }),
    );
  }
}
