import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Cliente Prisma singleton.
 * Conexión stateless (sin sesiones en memoria) → horizontal scaling (spec §5).
 * Connection pooling: en Supabase se usa PgBouncer vía DATABASE_URL (spec §7.3).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
