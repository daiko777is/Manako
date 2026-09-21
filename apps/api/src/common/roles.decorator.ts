import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@manako/shared';

export const ROLES_KEY = 'manako:roles';

/** Restringe la ruta a uno o más roles (RBAC validado SIEMPRE en backend, spec §6.1). */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
