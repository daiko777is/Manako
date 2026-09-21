import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId?: string;
  path?: string;
  timestamp: string;
}

/**
 * Manejo de errores centralizado (spec §8): todas las respuestas de error
 * tienen la forma consistente { statusCode, message, error }.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { id?: string }>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        message = (r['message'] as string | string[]) ?? exception.message;
        error = (r['error'] as string) ?? exception.name;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Los 5xx se loguean con stack; los 4xx son esperables (no son incidentes)
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${request.url} → ${status}: ${error}`);
    }

    const body: ErrorBody = {
      statusCode: status,
      message,
      error,
      requestId: request.id,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }
}
