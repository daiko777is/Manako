import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Feature flags simples desde tabla `feature_flags` (spec §5) con caché
 * en memoria de corta duración (evita golpear la BD en cada request).
 * Para escalar: mover a Redis manteniendo esta interfaz.
 */
@Injectable()
export class FeatureFlagsService {
  private cache = new Map<string, { value: boolean; at: number }>();
  private readonly ttlMs = 60_000;

  constructor(private readonly prisma: PrismaService) {}

  async isEnabled(key: string, fallback = false): Promise<boolean> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    try {
      const flag = await this.prisma.featureFlag.findUnique({ where: { key } });
      const value = flag?.enabled ?? fallback;
      this.cache.set(key, { value, at: Date.now() });
      return value;
    } catch {
      return fallback;
    }
  }
}
