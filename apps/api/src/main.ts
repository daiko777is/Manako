import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { RequestIdInterceptor } from './common/request-id.interceptor';

async function bootstrap(): Promise<void> {
  // rawBody: necesario para verificar la firma de los webhooks de Stripe
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // ── Seguridad (spec §6.3) ────────────────────────────────────────────────
  app.use(
    helmet({
      // La CSP estricta puede romper Swagger UI en desarrollo; en producción
      // se activa (ajustar directives si se sirve documentación ahí).
      contentSecurityPolicy: config.get('NODE_ENV') === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS con whitelist estricta de orígenes
  const origins = (config.get<string>('CORS_ORIGINS') ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins, credentials: true });

  // ── API: prefijo + versionado desde el día 1 (spec §8) ───────────────────
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Validación global de DTOs: whitelist + transform ─────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalInterceptors(new RequestIdInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  // ── Documentación viva: Swagger/OpenAPI (spec §8) ────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Manakō API')
    .setDescription(
      'API de la plataforma de cursos Manakō. Autenticación: JWT emitido por Supabase Auth (header `Authorization: Bearer <access_token>`).',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = config.get<number>('PORT') ?? 3000;
  await app.listen(port);
  logger.log(`🚀 Manakō API lista en http://localhost:${port}/api/v1 · docs en /api/docs`);
}

void bootstrap();
