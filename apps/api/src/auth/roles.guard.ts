import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@manako/shared';
import { Request } from 'express';
import { ROLES_KEY } from '../common/roles.decorator';
import type { RequestUser } from './auth.types';

/**
 * RBAC estricto validado en backend (spec §6.1): lee el metadata de
 * @Roles(...) y lo compara contra el rol de negocio del profile.
 * 'admin' siempre tiene acceso (rol compuesto implícito).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const user = request.user;
    if (!user) throw new ForbiddenException('Usuario no autenticado');

    if (user.role === 'admin') return true;
    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Se requiere rol: ${required.join(' o ')}`);
    }
    return true;
  }
}
