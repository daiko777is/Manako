import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

/**
 * Logging estructurado JSON (spec §8): una línea por request con método,
 * ruta, status, duración y request-id. En LOG_FORMAT=pretty usa el Logger
 * estándar de Nest (desarrollo local).
 */
@Injectable()
export class JsonLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  private readonly json: boolean;

  constructor(config: ConfigService) {
    this.json = (config.get<string>('LOG_FORMAT') ?? 'json') === 'json';
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const started = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = http.getResponse<Response>();
        const entry = {
          requestId: request.id,
          method: request.method,
          path: request.originalUrl,
          status: response.statusCode,
          durationMs: Date.now() - started,
        };
        if (this.json) {
          // stdout JSON puro para agregadores (Loki/CloudWatch/Logtail)
          process.stdout.write(`${JSON.stringify({ level: 'info', msg: 'request', ...entry })}\n`);
        } else {
          this.logger.log(`${entry.method} ${entry.path} ${entry.status} ${entry.durationMs}ms`);
        }
      }),
    );
  }
}
