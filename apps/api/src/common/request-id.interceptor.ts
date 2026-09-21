import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';

/**
 * Asigna un request-id a cada petición (header X-Request-Id, entrante o nuevo)
 * para trazabilidad en logs (spec §8: correlación de request ID).
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { id?: string }>();
    const response = http.getResponse<Response>();

    const incoming = request.headers['x-request-id'];
    const id = (Array.isArray(incoming) ? incoming[0] : incoming) || randomUUID();
    request.id = id;
    response.setHeader('X-Request-Id', id);

    return next.handle();
  }
}
