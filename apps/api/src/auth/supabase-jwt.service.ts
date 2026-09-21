import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  errors as joseErrors,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyOptions,
} from 'jose';

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string;
  email?: string;
  role?: string; // rol del JWT de Supabase ('authenticated' | 'anon' | 'service_role')
  user_metadata?: Record<string, unknown>;
  app_metadata?: Record<string, unknown>;
}

/**
 * Verifica los JWT emitidos por Supabase Auth (spec §3.5).
 * Soporta los dos esquemas de firma:
 *  - HS256 con SUPABASE_JWT_SECRET (configuración clásica)
 *  - Claves asimétricas vía JWKS con SUPABASE_JWKS_URL (nuevo estándar)
 * Supabase Auth es la única fuente de verdad de identidad; el rol de
 * negocio (student/instructor/admin) vive en la tabla `profiles`.
 */
@Injectable()
export class SupabaseJwtService {
  private readonly logger = new Logger(SupabaseJwtService.name);
  private readonly jwks?: ReturnType<typeof createRemoteJWKSet>;
  private readonly secret?: Uint8Array;
  private readonly issuer?: string;

  constructor(private readonly config: ConfigService) {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    const jwksUrl = this.config.get<string>('SUPABASE_JWKS_URL');
    this.issuer = this.config.get<string>('SUPABASE_JWT_ISSUER');

    if (jwksUrl) {
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    } else if (secret) {
      this.secret = new TextEncoder().encode(secret);
    } else {
      throw new Error('SUPABASE_JWT_SECRET o SUPABASE_JWKS_URL es obligatorio');
    }
  }

  async verify(token: string): Promise<SupabaseJwtPayload> {
    const options: JWTVerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;

    try {
      const { payload } = this.jwks
        ? await jwtVerify(token, this.jwks, options)
        : await jwtVerify(token, this.secret!, options);

      // Solo aceptamos tokens de usuarios autenticados (no anon/service)
      const jwtRole = payload.role as string | undefined;
      if (jwtRole && jwtRole !== 'authenticated') {
        throw new UnauthorizedException('Tipo de token no permitido');
      }
      if (!payload.sub) {
        throw new UnauthorizedException('Token sin sujeto');
      }
      return payload as SupabaseJwtPayload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      if (err instanceof joseErrors.JOSEError) {
        this.logger.warn(`JWT inválido: ${err.message}`);
        throw new UnauthorizedException('Token inválido o expirado');
      }
      throw err;
    }
  }
}
