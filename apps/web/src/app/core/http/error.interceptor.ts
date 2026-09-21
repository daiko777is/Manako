import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../toast/toast.service';

/**
 * Interceptor de errores centralizado (spec §9): muestra un toast
 * consistente y deja propagar el error para manejo local.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 401 en la ruta de perfil ocurre antes del login: no molestar con toast
      const silent = error.status === 401 && req.url.includes('/auth/me');
      if (!silent && error.status >= 400) {
        const data = error.error as { message?: string | string[] } | null;
        const message = Array.isArray(data?.message)
          ? data?.message?.join(', ')
          : (data?.message ?? `Error ${error.status} en la solicitud`);
        toast.error(typeof message === 'string' ? message : 'Error en la solicitud');
      }
      return throwError(() => error);
    }),
  );
};
