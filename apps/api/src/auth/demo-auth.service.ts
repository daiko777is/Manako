import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { SignJWT } from 'jose';
import type { Profile, UserRole } from '@manako/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface DemoLoginResponse {
  accessToken: string;
  expiresIn: string;
  profile: Profile;
  created: boolean;
}

/**
 * Autenticación DEMO (solo con DEMO_MODE=true):
 * emite JWT HS256 con el MISMO formato que Supabase Auth (sub/email/role=
 * 'authenticated'), firmados con SUPABASE_JWT_SECRET. Así el JwtAuthGuard
 * existente los valida sin cambios y el resto de la app funciona igual.
 *
 * ⚠️ No verifica contraseñas: es material de demostración. En producción
 * DEMO_MODE debe estar desactivado (el controller devuelve 404 si no).
 */
@Injectable()
export class DemoAuthService {
  private readonly logger = new Logger(DemoAuthService.name);
  private readonly secret: Uint8Array;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.secret = new TextEncoder().encode(
      config.get<string>('SUPABASE_JWT_SECRET') ?? 'manako-demo-jwt-secret-min-32-chars',
    );
  }

  /** Lista cuentas demo disponibles (para el selector del login). */
  async listDemoUsers(): Promise<{ email: string; fullName: string | null; role: UserRole }[]> {
    const rows = await this.prisma.profile.findMany({
      where: { email: { endsWith: '@manako.demo' } },
      select: { email: true, fullName: true, role: true },
      // Las cuentas seed (más antiguas) siempre primero en el selector
      orderBy: { createdAt: 'asc' },
      take: 8,
    });
    return rows;
  }

  /** Login/registro demo: crea el usuario si no existe (como student). */
  async login(email: string, fullName?: string): Promise<DemoLoginResponse> {
    const normalized = email.trim().toLowerCase();
    let profile = await this.findProfileByEmail(normalized);

    let created = false;
    if (!profile) {
      // Crear en auth.users → el trigger handle_new_user crea el profile
      const id = randomUUID();
      await this.prisma.$executeRaw`
        insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
        values (${id}::uuid, ${normalized},
                jsonb_build_object('full_name', ${fullName ?? normalized.split('@')[0]}),
                '{"role":"student"}'::jsonb)`;
      profile = await this.findProfileByEmail(normalized);
      if (!profile) {
        // Sin trigger (entorno raro): crear el profile a mano
        await this.prisma.profile.create({
          data: {
            id,
            email: normalized,
            fullName: fullName ?? normalized.split('@')[0] ?? null,
            role: 'student',
          },
        });
        profile = await this.findProfileByEmail(normalized);
      }
      created = true;
      this.logger.log(`Usuario demo creado: ${normalized}`);
    }
    if (!profile) throw new NotFoundException('No se pudo preparar la cuenta demo');

    const accessToken = await new SignJWT({
      email: profile.email,
      role: 'authenticated',
      // claim de app_metadata compatible con Supabase
      app_metadata: { provider: 'demo', roles: [profile.role] },
      user_metadata: { full_name: profile.fullName },
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(profile.id)
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(this.secret);

    return {
      accessToken,
      expiresIn: '7d',
      created,
      profile: {
        id: profile.id,
        email: profile.email,
        fullName: profile.fullName,
        role: profile.role,
        avatarUrl: profile.avatarUrl,
        createdAt: profile.createdAt.toISOString(),
      },
    };
  }

  private async findProfileByEmail(email: string) {
    return this.prisma.profile.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
  }
}
