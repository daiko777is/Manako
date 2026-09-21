import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import type { UserRole } from '@manako/shared';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../toast/toast.service';

/**
 * Guard de rol reutilizable (CanMatch + CanActivate). CanMatch evita
 * descargar siquiera el chunk de instructor/admin para un estudiante
 * (spec §7.1). El backend revalida SIEMPRE el rol (@Roles) — este guard
 * es solo UX (spec §6.1: nunca confiar solo en el frontend).
 */
function check(roles: UserRole[]): boolean | import('@angular/router').UrlTree {
  const auth = inject(AuthService);
  const router = inject(Router);
  const toast = inject(ToastService);

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  const role = auth.role();
  if (role && (roles.includes(role) || role === 'admin')) {
    return true;
  }
  toast.error('No tienes permiso para acceder a esta sección');
  return router.createUrlTree(['/']);
}

export const rolesGuard =
  (...roles: UserRole[]): CanMatchFn & CanActivateFn =>
  () =>
    check(roles);
