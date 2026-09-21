import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { AuthService } from '../auth/auth.service';

/**
 * Interceptor global (spec §9): adjunta el JWT de Supabase a cada petición
 * de la API. supabase-js gestiona el refresh automático del token.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return from(auth.getAccessToken()).pipe(
    switchMap((token) =>
      next(
        token
          ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
          : req,
      ),
    ),
  );
};
