import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../common/public.decorator';
import { REQUEST_USER_KEY, type RequestUser } from './auth.types';
import { SupabaseJwtService } from './supabase-jwt.service';

/**
 * Guard global de autenticación: valida el JWT de Supabase y carga el
 * profile (rol de negocio) desde BD. Rutas marcadas con @Public() lo omiten.
 *
 * Defensa en profundidad (spec §6.1): este guard es la capa de aplicación;
 * la segunda capa es RLS en Postgres para accesos directos vía supabase-js.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: SupabaseJwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();

    // Aun en rutas públicas intentamos resolver el usuario si viene token:
    // permite personalizar respuestas (p. ej. estado "viewer" del catálogo).
    const token = this.extractToken(request);
    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Falta el token de autenticación');
    }

    const payload = await this.jwtService.verify(token);
    const user = await this.loadOrCreateProfile(payload.sub, payload.email ?? '');
    request[REQUEST_USER_KEY] = user;
    // También se expone en request.user para el decorador @CurrentUser()
    (request as unknown as Record<string, unknown>)['user'] = user;

    if (!isPublic && !user) {
      throw new UnauthorizedException('Perfil no encontrado');
    }
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    return header.slice(7).trim() || null;
  }

  /**
   * Carga el profile por id; si no existe (p. ej. entorno sin trigger),
   * lo crea desde los claims del JWT. El rol por defecto es 'student';
   * promover roles es operación exclusiva de admins vía /admin/users.
   */
  private async loadOrCreateProfile(id: string, email: string): Promise<RequestUser | null> {
    const profile = await this.prisma.profile.findUnique({ where: { id } });
    if (profile) {
      return { id: profile.id, email: profile.email, role: profile.role, fullName: profile.fullName };
    }
    if (!email) return null;
    const created = await this.prisma.profile.create({
      data: { id, email, fullName: email.split('@')[0] ?? null, role: 'student' },
    });
    return { id: created.id, email: created.email, role: created.role, fullName: created.fullName };
  }
}
