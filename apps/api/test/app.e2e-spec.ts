import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * E2E del healthcheck y del catálogo público.
 * Requiere una BD de prueba reachable vía DATABASE_URL (docker compose up db
 * + migraciones aplicadas). En CI se ejecuta contra una BD efímera (spec §12).
 */
describe('Manakō API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /api/v1/health → 200 y estado de BD', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);
    expect(res.body).toEqual(expect.objectContaining({ status: expect.any(String) }));
  });

  it('GET /api/v1/courses → catálogo paginado (público)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/courses').expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body).toHaveProperty('nextCursor');
  });

  it('GET /api/v1/enrollments/me sin JWT → 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/enrollments/me').expect(401);
  });
});
